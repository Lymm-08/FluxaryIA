import unittest

from google.genai import types

from api.ai_provider import (
    AIProviderError,
    SYSTEM_INSTRUCTIONS,
    build_gemini_contents,
    get_provider_config,
)


class AIProviderTests(unittest.TestCase):
    def test_gemini_is_default_and_does_not_require_openai_key(self):
        config = get_provider_config({
            "GEMINI_API_KEY": "test-key-not-used-for-network",
        })

        self.assertEqual(config.provider, "gemini")
        self.assertEqual(config.model, "gemini-3.5-flash-lite")
        self.assertEqual(config.api_key, "test-key-not-used-for-network")

    def test_provider_can_be_changed_with_backend_configuration(self):
        config = get_provider_config({
            "AI_PROVIDER": "openai",
            "OPENAI_API_KEY": "test-key-not-used-for-network",
        })

        self.assertEqual(config.provider, "openai")
        self.assertEqual(config.model, "gpt-4o-mini")

    def test_missing_gemini_key_reports_service_configuration_error(self):
        with self.assertRaises(AIProviderError) as raised:
            get_provider_config({"AI_PROVIDER": "gemini"})

        self.assertEqual(raised.exception.stage, "provider_configuration")
        self.assertEqual(raised.exception.status, 503)

    def test_unsupported_provider_is_rejected(self):
        with self.assertRaises(AIProviderError) as raised:
            get_provider_config({"AI_PROVIDER": "unknown"})

        self.assertEqual(raised.exception.stage, "provider_selection")
        self.assertEqual(raised.exception.status, 503)

    def test_gemini_history_maps_assistant_messages_to_model_role(self):
        contents = build_gemini_contents(
            [
                {"role": "user", "content": "Quanto gastei?"},
                {"role": "assistant", "content": "Vou conferir os dados."},
            ],
            "Contexto e pergunta atual",
        )

        self.assertEqual([item["role"] for item in contents], ["user", "model", "user"])
        self.assertEqual(contents[-1]["parts"][0]["text"], "Contexto e pergunta atual")

    def test_google_sdk_accepts_generation_settings_and_conversation_content(self):
        contents = build_gemini_contents([], "Pergunta de teste")
        sdk_contents = [types.Content.model_validate(item) for item in contents]
        generation_config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTIONS,
            temperature=0.3,
            max_output_tokens=700,
        )

        self.assertEqual(sdk_contents[0].role, "user")
        self.assertEqual(generation_config.max_output_tokens, 700)

    def test_provider_quota_errors_are_retryable_without_details(self):
        error = AIProviderError("gemini", "generate_content", 429)

        self.assertEqual(error.status, 503)
        self.assertIn("limite temporário", error.message)
        self.assertNotIn("key", error.message.lower())


if __name__ == "__main__":
    unittest.main()
