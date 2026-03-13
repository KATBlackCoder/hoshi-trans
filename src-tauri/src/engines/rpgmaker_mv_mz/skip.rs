use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) {
        return true;
    }
    is_rpgmaker_control_code_only(text)
}

fn is_rpgmaker_control_code_only(text: &str) -> bool {
    matches!(text.trim(), r"\>" | r"\<" | r"\!" | r"\." | r"\|" | r"\^")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delegates_to_common_skip() {
        assert!(should_skip(""));
        assert!(should_skip("Hello"));
    }

    #[test]
    fn test_skip_rpgmaker_control_codes_only() {
        assert!(should_skip(r"\>"));
        assert!(should_skip(r"\<"));
    }

    #[test]
    fn test_keep_japanese_text() {
        assert!(!should_skip("勇者よ、立ち上がれ！"));
    }
}
