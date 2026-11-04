import unittest
from datetime import date

from api.chat import CONVERSATION_ID_PATTERN, _financial_summary, _month_keys


class ChatApiTests(unittest.TestCase):
    def test_summary_separates_spending_from_card_payments_and_planned_movements(self):
        data = {
            "transactions": [
                {"transaction_date": "2026-03-10", "amount": 75, "type": "expense", "category": "Mercado", "is_settled": True, "account_id": "account"},
                {"transaction_date": "2026-03-09", "amount": 100, "type": "expense", "category": "Lazer", "is_settled": True, "credit_card_id": "card", "credit_card_kind": "purchase"},
                {"transaction_date": "2026-03-08", "amount": 100, "type": "expense", "category": "Cartão", "is_settled": True, "account_id": "account", "credit_card_id": "card", "credit_card_kind": "payment"},
                {"transaction_date": "2026-03-07", "amount": 50, "type": "expense", "category": "Caixinha", "is_settled": True, "account_id": "account", "cash_box_kind": "deposit"},
                {"transaction_date": "2026-03-06", "amount": 25, "type": "income", "category": "Caixinha", "is_settled": True, "account_id": "account", "cash_box_kind": "withdrawal"},
                {"transaction_date": "2026-03-05", "amount": 400, "type": "expense", "category": "Planejada", "is_settled": False, "account_id": "account"},
                {"transaction_date": "2026-02-10", "amount": 200, "type": "income", "category": "Salário", "is_settled": True, "account_id": "account"},
                {"transaction_date": "2026-02-05", "amount": 300, "type": "expense", "category": "Viagem", "is_settled": True, "account_id": "account"},
            ],
            "accounts": [{"id": "account", "name": "Principal", "balance": 1000}],
            "credit_cards": [{"id": "card", "name": "Cartão", "credit_limit": 500}],
        }

        result = _financial_summary(data, date(2026, 3, 14))

        self.assertEqual(result["monthly_totals"][-1], {"month": "2026-03", "income": 0.0, "expenses": 175.0})
        self.assertEqual(result["current_month_top_expense_categories"], [
            {"category": "Lazer", "amount": 100.0},
            {"category": "Mercado", "amount": 75.0},
        ])
        self.assertEqual(result["planned_movements_count"], 1)
        self.assertEqual(result["accounts"][0]["calculated_balance"], 700.0)
        self.assertEqual(result["credit_cards"][0]["used_from_recorded_purchases"], 0.0)

    def test_month_window_crosses_year_boundary(self):
        self.assertEqual(
            _month_keys(date(2026, 1, 15), 6),
            ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"],
        )

    def test_conversation_id_requires_uuid_format(self):
        self.assertTrue(CONVERSATION_ID_PATTERN.fullmatch("d9428888-122b-4e31-b6c1-5a8b7b3f2a10"))
        self.assertFalse(CONVERSATION_ID_PATTERN.fullmatch("not-a-uuid"))


if __name__ == "__main__":
    unittest.main()
