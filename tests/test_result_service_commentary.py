import unittest

from backend.services.result_service import _complete_commentary_sentences


class CompleteCommentarySentencesTest(unittest.TestCase):
    def test_keeps_complete_text(self):
        text = "강점이 안정적입니다. 취약 영역을 복습해 보세요."

        self.assertEqual(_complete_commentary_sentences(text, 120), text)

    def test_removes_incomplete_tail(self):
        text = "강점이 안정적입니다. 실무형 정답률은"

        self.assertEqual(_complete_commentary_sentences(text, 120), "강점이 안정적입니다.")

    def test_rejects_incomplete_text(self):
        self.assertEqual(_complete_commentary_sentences("실무형 정답률은", 120), "")


if __name__ == "__main__":
    unittest.main()
