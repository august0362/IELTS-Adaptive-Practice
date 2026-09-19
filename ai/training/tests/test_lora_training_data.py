import json

import pytest

from training.lora_training_data import load_training_examples, split_train_eval, to_prompt_completion, validate_example


def _example(system: str = "sys", user: str = "hoi", assistant: str = "dap") -> dict:
    return {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }


class TestValidateExample:
    def test_accepts_a_well_formed_example(self):
        validate_example(_example())  # no raise

    def test_rejects_missing_messages_key(self):
        with pytest.raises(ValueError, match="messages"):
            validate_example({})

    def test_rejects_wrong_message_count(self):
        bad = _example()
        bad["messages"] = bad["messages"][:2]
        with pytest.raises(ValueError, match="3 messages"):
            validate_example(bad)

    def test_rejects_wrong_role_order(self):
        bad = _example()
        bad["messages"][0]["role"] = "user"
        bad["messages"][1]["role"] = "system"
        with pytest.raises(ValueError, match="roles"):
            validate_example(bad)

    def test_rejects_empty_content(self):
        bad = _example(assistant="   ")
        with pytest.raises(ValueError, match="content"):
            validate_example(bad)

    def test_rejects_non_string_content(self):
        bad = _example()
        bad["messages"][2]["content"] = None
        with pytest.raises(ValueError, match="content"):
            validate_example(bad)

    def test_rejects_non_dict_message(self):
        bad = _example()
        bad["messages"][1] = "not a dict"
        with pytest.raises(ValueError, match="roles"):
            validate_example(bad)


class TestLoadTrainingExamples:
    def test_loads_valid_jsonl(self, tmp_path):
        path = tmp_path / "data.jsonl"
        path.write_text(json.dumps(_example()) + "\n" + json.dumps(_example("s2", "u2", "a2")) + "\n", encoding="utf-8")
        examples = load_training_examples(path)
        assert len(examples) == 2

    def test_skips_blank_lines(self, tmp_path):
        path = tmp_path / "data.jsonl"
        path.write_text(json.dumps(_example()) + "\n\n\n", encoding="utf-8")
        assert len(load_training_examples(path)) == 1

    def test_reports_line_number_on_bad_json(self, tmp_path):
        path = tmp_path / "data.jsonl"
        path.write_text(json.dumps(_example()) + "\n{not json\n", encoding="utf-8")
        with pytest.raises(ValueError, match=r":2:"):
            load_training_examples(path)

    def test_reports_line_number_on_shape_violation(self, tmp_path):
        bad = _example()
        bad["messages"] = bad["messages"][:1]
        path = tmp_path / "data.jsonl"
        path.write_text(json.dumps(bad) + "\n", encoding="utf-8")
        with pytest.raises(ValueError, match=r":1:"):
            load_training_examples(path)


class TestToPromptCompletion:
    def test_splits_into_prompt_and_completion(self):
        example = _example(system="sys", user="hoi", assistant="dap")
        result = to_prompt_completion(example)
        assert result["prompt"] == [{"role": "system", "content": "sys"}, {"role": "user", "content": "hoi"}]
        assert result["completion"] == [{"role": "assistant", "content": "dap"}]

    def test_does_not_mutate_the_original_example(self):
        example = _example()
        original = json.loads(json.dumps(example))
        to_prompt_completion(example)
        assert example == original

    def test_result_has_no_other_keys(self):
        result = to_prompt_completion(_example())
        assert set(result.keys()) == {"prompt", "completion"}


class TestSplitTrainEval:
    def test_splits_by_fraction_deterministically(self):
        examples = [_example(user=f"u{i}") for i in range(20)]
        train1, eval1 = split_train_eval(examples, eval_fraction=0.1, seed=7)
        train2, eval2 = split_train_eval(examples, eval_fraction=0.1, seed=7)
        assert len(eval1) == 2
        assert len(train1) == 18
        assert train1 == train2 and eval1 == eval2

    def test_different_seed_can_change_split(self):
        examples = [_example(user=f"u{i}") for i in range(20)]
        _, eval1 = split_train_eval(examples, eval_fraction=0.1, seed=1)
        _, eval2 = split_train_eval(examples, eval_fraction=0.1, seed=2)
        assert eval1 != eval2

    def test_train_and_eval_together_cover_all_examples_with_no_overlap(self):
        examples = [_example(user=f"u{i}") for i in range(58)]
        train, eval_ = split_train_eval(examples, eval_fraction=0.1, seed=7)
        assert len(train) + len(eval_) == len(examples)
        train_users = {e["messages"][1]["content"] for e in train}
        eval_users = {e["messages"][1]["content"] for e in eval_}
        assert train_users.isdisjoint(eval_users)

    def test_empty_input_returns_empty_splits(self):
        assert split_train_eval([], eval_fraction=0.1, seed=7) == ([], [])

    def test_at_least_one_eval_example_when_fraction_rounds_to_zero(self):
        examples = [_example(user=f"u{i}") for i in range(3)]
        _, eval_ = split_train_eval(examples, eval_fraction=0.05, seed=7)
        assert len(eval_) == 1
