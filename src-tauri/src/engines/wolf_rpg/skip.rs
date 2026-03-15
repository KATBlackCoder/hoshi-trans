use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) {
        return true;
    }
    is_wolf_db_reference(text)
}

fn is_wolf_db_reference(text: &str) -> bool {
    text.contains("cdb[") || text.starts_with("sdb:")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delegates_to_common() {
        assert!(should_skip(""));
        assert!(should_skip("Hello"));
    }

    #[test]
    fn test_skip_wolf_db_reference() {
        assert!(should_skip("cdb[sdb:0:0]"));
    }

    #[test]
    fn test_keep_japanese() {
        assert!(!should_skip("勇者よ、立ち上がれ！"));
    }
}
