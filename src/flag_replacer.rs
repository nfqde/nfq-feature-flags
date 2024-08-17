#[path = "config.rs"] mod config;
use crate::config::Config;

use std::{
    cell::RefCell,
    collections::HashMap,
    rc::Rc
};

use colored::*;
use swc_core::{
    common::{
        SourceMapper,
        Span
    },
    ecma::{
        ast::{
            Bool,
            Expr,
            ImportDecl,
            ImportSpecifier,
            JSXAttr,
            JSXAttrName,
            Lit
        },
        visit::{VisitMut, VisitMutWith}
    },
    plugin::proxies::PluginSourceMapProxy
};

pub struct FlagReplacer {
    pub config: Config,
    pub source_map: PluginSourceMapProxy,
    pub flags: HashMap<String, bool>,
    pub found_flags: Rc<RefCell<HashMap<Span, String>>>,
    current_attribute: Option<String>
}

impl FlagReplacer {
    // Constructor
    pub fn new(config: Config, found_flags: Rc<RefCell<HashMap<Span, String>>>, source_map: PluginSourceMapProxy) -> Self {
        let feature_env = config.feature_env.clone();
        let flags = config.feature_flags.get(&feature_env);
        let clone: HashMap<String, bool>;

        if flags.is_none() {
            println!("{}{}", "No flags provided for this env: ".red().bold(), feature_env.white().bold());
            clone = HashMap::new();
        } else {
            clone = flags.unwrap().clone();
        }

        FlagReplacer { config, source_map, flags: clone, found_flags, current_attribute: None }
    }

    fn is_flag(&self, ident: String) -> bool {
        let flag = self.flags.get(&ident);

        !flag.is_none()
    }

    fn is_flag_import(&self, import_path: &str) -> bool {
        self.config.feature_flag_import == import_path
    }

    fn is_jsx_import(&self, import_path: &str) -> bool {
        self.config.jsx_import == import_path
    }

    fn get_flag(&self, ident: String) -> bool {
        let flag = self.flags.get(&ident);

        flag.unwrap().clone()
    }

    fn create_boolean(&mut self, value: bool, span: Span) -> Expr {
        let bool_lit = Bool {
            span,
            value
        };
        let expr = Expr::Lit(Lit::Bool(bool_lit));

        expr
    }
}

impl VisitMut for FlagReplacer {
    fn visit_mut_import_decl(&mut self, import: &mut ImportDecl) {
        let path = import.src.value.to_string();

        if self.is_flag_import(&path) {
            for specifier in &import.specifiers {
                if let ImportSpecifier::Named(named) = specifier {
                    let specifier_str = named.local.sym.to_string();

                    if self.flags.get(&specifier_str).is_none() {
                        println!(
                            "{}{}{}{}{}",
                            "Imported ".red(),
                            specifier_str.red().bold(),
                            " from ".red(),
                            path.red().bold(),
                            " which is not a supported flag.".red()
                        );
                    }
                }
            }
        }

        if self.is_jsx_import(&path) {
            let allowed_specifiers: [&str; 2] = [self.config.jsx_with_feature.as_str(), self.config.jsx_without_feature.as_str()];
            for specifier in &import.specifiers {
                if let ImportSpecifier::Named(named) = specifier {
                    let specifier_str = named.local.sym.to_string();

                    if !allowed_specifiers.contains(&specifier_str.as_str()) {
                        println!(
                            "{}{}{}{}{}",
                            "Imported ".red(),
                            specifier_str.red().bold(),
                            " from ".red(),
                            path.red().bold(),
                            " which is not a supported flag.".red()
                        );
                    }
                }
            }
        }

        import.visit_mut_children_with(self);
    }

    fn visit_mut_jsx_attr(&mut self, attr: &mut JSXAttr) {
        if let JSXAttrName::Ident(ident) = &attr.name {
            self.current_attribute = Some(ident.sym.to_string());
        }

        attr.visit_mut_children_with(self);

        self.current_attribute = None;
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Expr::Ident(ident) = expr {
            if self.is_flag(ident.sym.to_string()) {
                let flags = self.config.feature_flags.get(&self.config.deprecation_env);

                if flags.is_some() && *flags.unwrap().get(&ident.sym.to_string()).unwrap() == true {
                    if self.current_attribute.is_none() {
                        let meta = self.source_map.lookup_char_pos(ident.span.lo());

                        println!(
                            "{} {} The Flag {} is deprecated because its active in live environment.",
                            "Warning!:".yellow().bold(),
                            format!(
                                "{}:{}:{}",
                                meta.file.name,
                                meta.line,
                                meta.col_display
                            ).blue().bold(),
                            ident.sym.to_string().green().bold()
                        );
                    }
                }

                if self.current_attribute.is_some() && self.current_attribute.as_ref().unwrap() == "feature" {
                    self.found_flags.borrow_mut().insert(ident.span, ident.sym.to_string());
                }

                *expr = self.create_boolean(self.get_flag(ident.sym.to_string()), ident.span);
            }
        }

        expr.visit_mut_children_with(self);
    }
}