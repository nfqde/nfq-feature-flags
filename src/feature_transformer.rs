#[path = "config.rs"] mod config;
use crate::config::Config;

use std::{
    cell::RefCell,
    collections::HashMap,
    rc::Rc
};

use chrono::{NaiveDate, Utc};
use colored::*;
use swc_core::{
    common::{
        DUMMY_SP,
        SourceMapper,
        Span,
        util::take::Take
    },
    ecma::{
        ast::{
            BinExpr,
            BinaryOp,
            Bool,
            Expr,
            ExprOrSpread,
            Ident,
            JSXAttr,
            JSXAttrName,
            JSXAttrOrSpread,
            JSXAttrValue,
            JSXClosingElement,
            JSXClosingFragment,
            JSXElement,
            JSXElementChild,
            JSXElementName,
            JSXExpr,
            JSXExprContainer,
            JSXFragment,
            JSXOpeningElement,
            JSXOpeningFragment,
            Lit,
            ParenExpr,
            UnaryExpr,
            UnaryOp
        },
        visit::{VisitMut, VisitMutWith},
    },
    plugin::proxies::PluginSourceMapProxy
};

struct FoundAttributes {
    feature_values: Option<Vec<Bool>>,
    deprecates_on_value: Option<String>,
    never_deprecates: bool
}

pub struct FeatureTransformer {
    pub config: Config,
    pub source_map: PluginSourceMapProxy,
    pub found_flags: Rc<RefCell<HashMap<Span, String>>>
}

impl FeatureTransformer {
    // Constructor
    pub fn new(config: Config, found_flags: Rc<RefCell<HashMap<Span, String>>>, source_map: PluginSourceMapProxy) -> Self {
        FeatureTransformer { config, found_flags, source_map }
    }

    fn is_feature_jsx(&self, jsx_element: &JSXOpeningElement) -> bool {
        if let JSXElementName::Ident(ident) = &jsx_element.name {
            return ident.sym == self.config.jsx_with_feature || ident.sym == self.config.jsx_without_feature;
        }

        return false;
    }

    fn get_jsx_attributes(&self, jsx_attrs: &Vec<JSXAttrOrSpread>) -> FoundAttributes {
        let mut feature_values: Option<Vec<Bool>> = None;
        let mut deprecates_on_value: Option<String> = None;
        let mut never_deprecates: bool = false;

        for attr in jsx_attrs {
            if let JSXAttrOrSpread::JSXAttr(JSXAttr {
                name: JSXAttrName::Ident(name),
                value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                    expr: JSXExpr::Expr(feature_expr),
                    ..
                })),
                ..
            }) = attr {
                if name.sym == "feature" {
                    if feature_expr.is_array() {
                        let bool_values = feature_expr.as_array().unwrap().elems.iter().filter_map(|elem| {
                            if let Some(ExprOrSpread {
                                expr: box Expr::Lit(Lit::Bool(value)),
                                ..
                            }) = elem
                            {
                                Some(*value)
                            } else {
                                None
                            }
                        }).collect::<Vec<_>>();

                        feature_values = Some(bool_values);
                    } else if let Expr::Lit(Lit::Bool(feature)) = feature_expr.as_ref() {
                        feature_values = Some(vec![*feature]);
                    }
                }
            } else if let JSXAttrOrSpread::JSXAttr(JSXAttr {
                name: JSXAttrName::Ident(name),
                value: Some(JSXAttrValue::Str(value)),
                ..
            }) = attr {
                if name.sym == "deprecatesOn" {
                    deprecates_on_value = Some(value.value.as_str().unwrap().to_string());
                }
            } else if let JSXAttrOrSpread::JSXAttr(JSXAttr {
                name: JSXAttrName::Ident(name),
                value: None,
                ..
            }) = attr {
                if name.sym == "neverDeprecates" {
                    never_deprecates = true;
                }
            }
        }


        return FoundAttributes {
            feature_values,
            deprecates_on_value,
            never_deprecates
        };
    }

    fn is_deprecated(&self, deprecates_date: &Option<String>) -> bool {
        if let Some(deprecates_on) = deprecates_date {
            let today = Utc::now().date_naive();

            if let Ok(date) = NaiveDate::parse_from_str(deprecates_on, "%Y-%m-%d") {
                return date < today;
            }
        }

        return false;
    }

    fn check_deprectaion(&self, attributes: &FoundAttributes, jsx_name: &str, jsx_span: Span) {
        if attributes.never_deprecates {
            return;
        }

        let feature_names = self.get_feature_names(&attributes.feature_values);
        let flags = self.config.feature_flags.get(&self.config.deprecation_env);
        let meta = self.source_map.lookup_char_pos(jsx_span.lo());

        if feature_names.len() == 0 {
            println!(
                "{} {} {} {}",
                "Error!:".red().bold(),
                format!(
                    "{}:{}:{}",
                    meta.file.name,
                    meta.line,
                    meta.col_display
                ).blue().bold(),
                jsx_name.green().bold(),
                "has no feature prop!".red().bold(),
            );

            return;
        }

        if self.is_deprecated(&attributes.deprecates_on_value) {
            println!(
                "{} {} {} (with features {}) is deprecated since {}!",
                "Warning!:".yellow().bold(),
                format!(
                    "{}:{}:{}",
                    meta.file.name,
                    meta.line,
                    meta.col_display
                ).blue().bold(),
                jsx_name.green().bold(),
                feature_names.join(", ").green().bold(),
                attributes.deprecates_on_value.clone().unwrap().green().bold()
            );
        } else if flags.is_some() && feature_names.clone().into_iter().any(|v| *flags.unwrap().get(&v).unwrap()) {
            println!(
                "{} {} {} (with features {}) is deprecated because its active in live environment!",
                "Warning!:".yellow().bold(),
                format!(
                    "{}:{}:{}",
                    meta.file.name,
                    meta.line,
                    meta.col_display
                ).blue().bold(),
                jsx_name.green().bold(),
                feature_names.join(", ").green().bold()
            );
        }
    }

    fn get_feature_names(&self, feature_values: &Option<Vec<Bool>>) -> Vec<String> {
        if let Some(values) = feature_values {
            return values.iter().map(|value| {
                if self.found_flags.borrow().contains_key(&value.span) {
                    return self.found_flags.borrow().get(&value.span).unwrap().to_string();
                } else {
                    return "Unknown".to_string();
                }
            }).collect();
        }

        return vec![];
    }

    fn create_boolean_expr(&self, value: bool) -> Box<Expr> {
        Box::new(Expr::Lit(Lit::Bool(Bool {
            span: DUMMY_SP,
            value: value
        })))
    }

    fn create_unary_boolean_expr(&self, value: bool) -> Box<Expr> {
        Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Bang,
            arg: Box::new(Expr::Lit(Lit::Bool(Bool {
                span: DUMMY_SP,
                value: value
            })))
        }))
    }
}

impl VisitMut for FeatureTransformer {
    fn visit_mut_jsx_element(&mut self, jsx_element: &mut JSXElement) {
        if self.is_feature_jsx(&jsx_element.opening) {
            let mut name = "";

            if let JSXElementName::Ident(ident) = &jsx_element.opening.name {
                name = ident.sym.as_str();
            }
            let attributes = self.get_jsx_attributes(&jsx_element.opening.attrs);

            self.check_deprectaion(&attributes, name, jsx_element.opening.span);

            if let Some(parsed_vales) = &attributes.feature_values {
                let mut cond_expr: Option<Box<Expr>> = None;

                for value in parsed_vales {
                    let bool_expr = if name == self.config.jsx_with_feature {
                        self.create_boolean_expr(value.value)
                    } else {
                        self.create_unary_boolean_expr(value.value)
                    };

                    cond_expr = Some(if let Some(existing_expr) = cond_expr {
                        Box::new(Expr::Bin(BinExpr {
                            span: DUMMY_SP,
                            op: BinaryOp::LogicalAnd,
                            left: existing_expr,
                            right: bool_expr,
                        }))
                    } else {
                        bool_expr
                    });
                }

                if let Some(cond_expr) = cond_expr {
                    let fragment = JSXFragment {
                        span: DUMMY_SP,
                        opening: JSXOpeningFragment { span: DUMMY_SP },
                        children: jsx_element.children.take(),
                        closing: JSXClosingFragment { span: DUMMY_SP },
                    };

                    let jsx_expr = ParenExpr {
                        span: DUMMY_SP,
                        expr: Box::new(Expr::JSXFragment(fragment)),
                    };

                    let wrapped_expr = ParenExpr {
                        span: DUMMY_SP,
                        expr: cond_expr
                    };

                    let final_expr = Expr::Bin(BinExpr {
                        span: DUMMY_SP,
                        op: BinaryOp::LogicalAnd,
                        left: Box::new(Expr::Paren(wrapped_expr)),
                        right: Box::new(Expr::Paren(jsx_expr))
                    });

                    let jsx_expr_container = JSXExprContainer {
                        span: DUMMY_SP,
                        expr: JSXExpr::Expr(Box::new(final_expr)),
                    };

                    let fragment_wrapper = JSXElement {
                        span: DUMMY_SP,
                        opening: JSXOpeningElement {
                            span: DUMMY_SP,
                            name: JSXElementName::Ident(Ident::new("Fragment".into(), DUMMY_SP, Default::default())),
                            attrs: vec![],
                            self_closing: false,
                            type_args: None,
                        },
                        children: vec![JSXElementChild::JSXExprContainer(jsx_expr_container)],
                        closing: Some(JSXClosingElement {
                            span: DUMMY_SP,
                            name: JSXElementName::Ident(Ident::new("Fragment".into(), DUMMY_SP, Default::default())),
                        })
                    };

                    *jsx_element = fragment_wrapper;
                }
            }
        }

        jsx_element.visit_mut_children_with(self);
    }
}