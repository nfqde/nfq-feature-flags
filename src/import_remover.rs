#[path = "config.rs"] mod config;
use crate::config::Config;

use std::{
    collections::HashMap,
    cell::RefCell,
    rc::Rc,
};

use swc_core::{
    common::{DUMMY_SP, Span},
    ecma::{
        ast::{
            Ident,
            ImportDecl,
            ImportNamedSpecifier,
            ImportSpecifier,
            Module,
            ModuleDecl,
            ModuleItem,
            Str
        },
        visit::{VisitMut, VisitMutWith},
    }
};

pub struct ImportRemover {
    pub config: Config,
    pub found_flags: Rc<RefCell<HashMap<Span, String>>>
}

impl ImportRemover {
    // Constructor
    pub fn new(config: Config, found_flags: Rc<RefCell<HashMap<Span, String>>>) -> Self {
        ImportRemover { config, found_flags }
    }

    fn should_remove_import(&self, import_path: &str) -> bool {
        self.config.feature_flag_import == import_path
            || self.config.jsx_import == import_path
    }

    fn create_fragment_import(&self) -> ModuleItem {
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
                local: Ident::new("Fragment".into(), DUMMY_SP, Default::default()),
                imported: None,
                span: DUMMY_SP,
                is_type_only: false
            })],
            src: Box::new(Str {
                span: DUMMY_SP,
                value: "react".into(),
                raw: Some("'react'".into()),
            }),
            with: None,
            type_only: false,
            phase: Default::default()
        }))
    }
}

impl VisitMut for ImportRemover {
    fn visit_mut_module(&mut self, module: &mut Module) {
        module.body.retain(|item| {
            if let ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) = item {
                let import_path = import_decl.src.value.to_string();
                !self.should_remove_import(&import_path)
            } else {
                true
            }
        });

        if self.found_flags.borrow().len() > 0 {
            let mut found_fragment = false;

            for item in module.body.iter_mut() {
                if let ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) = item {
                    let import_path = import_decl.src.value.to_string();

                    if import_path == "react" {
                        for specifier in &import_decl.specifiers {
                            if let ImportSpecifier::Named(ImportNamedSpecifier { local, .. }) = specifier {
                                if local.sym == "Fragment" {
                                    found_fragment = true;
                                }
                            }
                        }
                    }
                }
            }

            if !found_fragment {
                module.body.insert(0, self.create_fragment_import());
            }
        }

        module.visit_mut_children_with(self);
    }
}