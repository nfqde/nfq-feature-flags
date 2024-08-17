#![feature(box_patterns)]
mod config;
mod flag_replacer;
mod feature_transformer;
mod import_remover;

use crate::config::Config;
use crate::flag_replacer::FlagReplacer;
use crate::feature_transformer::FeatureTransformer;
use crate::import_remover::ImportRemover;

use std::{
    collections::HashMap,
    cell::RefCell,
    rc::Rc,
};

use colored::*;
use swc_core::{
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
    ecma::{
        ast::Program,
        visit::VisitMutWith,
    }
};

/// An example plugin function with macro support.
/// `plugin_transform` macro interop pointers into deserialized structs, as well
/// as returning ptr back to host.
///
/// It is possible to opt out from macro by writing transform fn manually
/// if plugin need to handle low-level ptr directly via
/// `__transform_plugin_process_impl(
///     ast_ptr: *const u8, ast_ptr_len: i32,
///     unresolved_mark: u32, should_enable_comments_proxy: i32) ->
///     i32 /*  0 for success, fail otherwise.
///             Note this is only for internal pointer interop result,
///             not actual transform result */`
///
/// This requires manual handling of serialization / deserialization from ptrs.
/// Refer swc_plugin_macro to see how does it work internally.
#[plugin_transform]
pub fn process_transform(mut program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    let config = serde_json::from_str::<Config>(
        &_metadata
            .get_transform_plugin_config()
            .expect("failed to get plugin config for nfq-feature-flags".red().bold().to_string().as_str()),
    )
    .expect("invalid config for nfq-feature-flags".red().bold().to_string().as_str());
    let source_map = _metadata.source_map;
    let found_flags = Rc::new(RefCell::new(HashMap::new()));

    program.visit_mut_with(&mut FlagReplacer::new(config.clone(), Rc::clone(&found_flags), source_map.clone()));
    program.visit_mut_with(&mut FeatureTransformer::new(config.clone(), Rc::clone(&found_flags), source_map));
    program.visit_mut_with(&mut ImportRemover::new(config.clone(), Rc::clone(&found_flags)));
    program
}