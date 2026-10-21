from pitchpulse_agents.facts import (
    build_facts,
    check_evidence,
    check_names,
    check_numbers,
    numbers_in,
)
from pitchpulse_agents.models import Evidence


def test_facts_flatten_stats_event_and_score(moment):
    f = build_facts(moment)
    assert f["xg.away"] == 1.31
    assert f["event.xg"] == 0.42
    assert f["score.home"] == 1
    assert f["minute"] == 63
    assert f["team.away.short"] == "MER"


def test_numbers_from_the_data_pass(moment):
    f = build_facts(moment)
    assert check_numbers("Quinn's 0.42 xG strike at 112 km/h in minute 63", f) == []
    assert check_numbers("MER have pressed 14 times; control sits at 69%.", f) == []


def test_invented_numbers_are_rejected(moment):
    f = build_facts(moment)
    assert check_numbers("An xG of 0.61 from 25 metres.", f) == [
        "number 0.61 is not in the match data",
        "number 25 is not in the match data",
    ]


def test_probability_can_be_said_as_a_percentage(moment):
    assert check_numbers("A 42% chance.", build_facts(moment)) == []


def test_comma_decimals_and_other_scripts_are_checked(moment):
    f = build_facts(moment)
    assert check_numbers("Un tiro de 0,42 xG.", f) == []
    assert numbers_in("تسديدة ٠٫٤٢") == [0.42]  # Arabic-Indic digits and decimal sign
    assert check_numbers("ضغط ١٤ مرة", f) == []
    assert check_numbers("ضغط ١٧ مرة", f) == ["number 17 is not in the match data"]


def test_evidence_must_cite_real_keys_and_values(moment):
    f = build_facts(moment)
    assert check_evidence([Evidence(stat="xg.away", value=1.31)], f) == []
    assert check_evidence([Evidence(stat="xg.away", value=1.5)], f) == [
        "xg.away is 1.31, not 1.5"
    ]
    assert check_evidence([Evidence(stat="xg.total", value=2)], f) == [
        "unknown stat 'xg.total'"
    ]


def test_player_must_be_named_exactly():
    event = {"player": "Theo Quinn"}
    assert check_names("Theo Quinn shoots!", event) == []
    assert check_names("¡Disparo de Quinn!", event) == []
    assert check_names("تسديدة ثيرو كوين", event) == [
        'name the player exactly as "Theo Quinn" in Latin letters'
    ]
    assert check_names("Anything", {"type": "possession"}) == []
