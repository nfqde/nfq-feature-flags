use std::collections::HashMap;

use serde::Deserialize;

#[derive(Default, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(unused)]
pub struct Config {
    #[serde(default = "default_feature_env")]
    pub feature_env: String,
    #[serde(default = "default_deprecation_env")]
    pub deprecation_env: String,
    #[serde(default = "default_feature_flag_import")]
    pub feature_flag_import: String,
    #[serde(default)]
    pub feature_flags: HashMap<String, HashMap<String, bool>>,
    #[serde(default = "default_jsx_import")]
    pub jsx_import: String,
    #[serde(default = "default_jsx_with_feature")]
    pub jsx_with_feature: String,
    #[serde(default = "default_jsx_without_feature")]
    pub jsx_without_feature: String,
}

fn default_feature_env() -> String {
    "stage".to_string()
}

fn default_deprecation_env() -> String {
    "live".to_string()
}

fn default_feature_flag_import() -> String {
    "@app/features".to_string()
}

fn default_jsx_import() -> String {
    "@nfq/feature-flags/jsx".to_string()
}

fn default_jsx_with_feature() -> String {
    "WithFeature".to_string()
}

fn default_jsx_without_feature() -> String {
    "WithoutFeature".to_string()
}