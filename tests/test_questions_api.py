from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi import HTTPException

from backend.models.schemas import SubjectQuizListRequest
from backend.routers.quiz import get_questions_by_category, get_quiz_list
from backend.services.question_repository import QuestionRow, SubjectQuestionRow


def make_question(question_id: int, category: str) -> QuestionRow:
    return QuestionRow(
        id=question_id,
        category=category,
        sub_category=None,
        source_type="MANUAL",
        source_id=None,
        question_text=f"question {question_id}",
        option_1="A",
        option_2="B",
        option_3="C",
        option_4="D",
        correct_option_no=1,
        explanation="because",
        difficulty="medium",
        tags=[],
        solved_count=0,
        correct_count=0,
        is_active=True,
        created_at=None,
        updated_at=None,
    )


class GetQuestionsByCategoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_returns_questions_for_category(self):
        with patch(
            "backend.routers.quiz.question_repository.get_questions_by_category",
            return_value=[make_question(1, "AI"), make_question(2, "AI")],
        ):
            response = await get_questions_by_category("AI")

        self.assertEqual(len(response), 2)
        self.assertEqual(response[0].question_text, "question 1")
        self.assertEqual(response[0].option_1, "A")
        self.assertEqual(response[0].difficulty, "medium")

    async def test_raises_404_when_category_has_no_questions(self):
        with patch(
            "backend.routers.quiz.question_repository.get_questions_by_category",
            return_value=[],
        ):
            with self.assertRaises(HTTPException) as ctx:
                await get_questions_by_category("UNKNOWN")

        self.assertEqual(ctx.exception.status_code, 404)


class GetQuizListTests(unittest.IsolatedAsyncioTestCase):
    async def test_returns_questions_for_subject_code(self):
        request = SubjectQuizListRequest(subject_code="AI", count=2)
        questions = [
            SubjectQuestionRow(
                question_id="001",
                subject_code="AI",
                major_unit="AI",
                minor_unit="ML",
                question_type="객관식",
                question_content="question 1",
                question_content2=None,
                option_1="A",
                option_2="B",
                option_3="C",
                option_4="D",
                option_5=None,
                answer_number=1,
                explanation="because",
            ),
            SubjectQuestionRow(
                question_id="002",
                subject_code="AI",
                major_unit="AI",
                minor_unit="ML",
                question_type="객관식",
                question_content="question 2",
                question_content2="extra",
                option_1="A",
                option_2="B",
                option_3="C",
                option_4="D",
                option_5="E",
                answer_number=2,
                explanation="why",
            ),
        ]

        with patch(
            "backend.routers.quiz.question_repository.get_questions_by_subject_code",
            return_value=questions,
        ):
            response = await get_quiz_list(request)

        self.assertEqual(response.subject_code, "AI")
        self.assertEqual(response.returned_count, 2)
        self.assertEqual(response.items[0].choices, ["A", "B", "C", "D"])
        self.assertEqual(response.items[1].question_text_extra, "extra")

    async def test_raises_404_when_subject_code_has_no_questions(self):
        request = SubjectQuizListRequest(subject_code="SUB999", count=3)

        with patch(
            "backend.routers.quiz.question_repository.get_questions_by_subject_code",
            return_value=[],
        ):
            with self.assertRaises(HTTPException) as ctx:
                await get_quiz_list(request)

        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
