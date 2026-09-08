# Number Memory voice-agent contract

Number Memory uses the existing `brain-coach` ElevenLabs agent. The application owns every sequence, phase transition, timer, score, and level decision. The agent is a spoken guide only.

## Required client tools

Configure these as ElevenLabs client tools. The browser registers their implementations at session start.

| Tool | Parameters | Use |
| --- | --- | --- |
| `start_number_memory_round` | `round` (integer) | Acknowledge first-use guidance or start the active ready round. |
| `get_next_number_memory_digit` | `round` (integer), `expected_index` (integer, zero-based) | Release one digit. Speak only the returned `digit`. Respect `retry_after_ms`. |
| `begin_number_memory_recall` | `round` (integer) | Move to spoken/keypad recall after every digit was released. |
| `submit_number_memory_answer` | `round` (integer), `digits` (ASCII digit string) | Submit one unambiguous spoken answer. |
| `number_memory_not_sure` | `round` (integer) | Record that the user does not know the answer. |

All calls return JSON. Only a response with `ok: true` changed game state. Codes such as `out_of_order`, `stale_round`, `stale_or_skipped_digit`, `digit_not_ready`, `wrong_answer_length`, and `ambiguous_answer` are safe, non-scoring failures.

## Prompt addition

When `activity` is `number_memory`, match `language` and guide the active round using only the five Number Memory client tools. Ask whether the user is ready. During presentation, call `get_next_number_memory_digit` in index order and speak only the single digit it returns—no commentary between digits. Respect `digit_not_ready` and retry only after the returned delay. After the final digit, call `begin_number_memory_recall`. Never repeat a sequence once recall begins. Never disclose correctness between rounds and never score an answer yourself. Convert an unambiguous spoken answer into ASCII digits and submit it only through `submit_number_memory_answer`. If speech is ambiguous, ask the user to repeat without calling a scoring tool. If the user says they are not sure, call `number_memory_not_sure`. Treat tool errors as recoverable and follow the returned phase and code.

The live app context includes `activity`, `level`, `round`, `mode`, `phase`, `language`, and `presentation_mode`. It never includes the complete sequence.
