"""
VOID//CTF companion plugin (optional, read-only).

Why it exists: CTFd's public REST API has no single endpoint for event-wide
totals (players, teams, solves) and only returns per-account solve history for
the top 50 accounts. The VOID theme uses these two endpoints for the landing
page counters and the scoreboard "solves" column.

Both endpoints:
  * are GET-only and never write to the database,
  * reuse CTFd's own visibility checks (challenges/accounts/scores visibility),
  * respect the scoreboard freeze for non-admins, and
  * exclude hidden and banned accounts, exactly like CTFd's standings.

The theme degrades gracefully (shows "—") when this plugin is not installed.
"""

from flask import Blueprint, jsonify

from CTFd.cache import cache
from CTFd.models import Challenges, Solves, Teams, Users, db
from CTFd.utils import get_config
from CTFd.utils.config.visibility import (
    accounts_visible,
    challenges_visible,
    scores_visible,
)
from CTFd.utils.dates import ctf_started, unix_time_to_utc
from CTFd.utils.modes import TEAMS_MODE
from CTFd.utils.user import is_admin

void_api = Blueprint("void_ctf", __name__, url_prefix="/void/api")


def _teams_mode():
    return get_config("user_mode") == TEAMS_MODE


def _solve_query(admin):
    """Solves by visible (not hidden, not banned) accounts, freeze-aware."""
    if _teams_mode():
        account_col = Solves.team_id
        Model = Teams
    else:
        account_col = Solves.user_id
        Model = Users

    q = (
        db.session.query(account_col.label("account_id"), db.func.count(Solves.id))
        .join(Model, Model.id == account_col)
        .join(Challenges, Challenges.id == Solves.challenge_id)
        .filter(Model.banned == False, Model.hidden == False)  # noqa: E712
    )
    freeze = get_config("freeze")
    if freeze and not admin:
        q = q.filter(Solves.date < unix_time_to_utc(freeze))
    return q


@cache.memoize(timeout=30)
def _summary(show_challenges, show_accounts, show_scores, admin, teams_mode):
    data = {"challenges": None, "players": None, "teams": None, "solves": None}

    if show_challenges:
        data["challenges"] = Challenges.query.filter(
            Challenges.state == "visible"
        ).count()

    if show_accounts:
        data["players"] = Users.query.filter_by(banned=False, hidden=False).count()
        if teams_mode:
            data["teams"] = Teams.query.filter_by(banned=False, hidden=False).count()

    if show_scores and show_accounts:
        data["solves"] = sum(n for _, n in _solve_query(admin).group_by("account_id"))

    return data


@cache.memoize(timeout=30)
def _solve_counts(admin, teams_mode):
    rows = _solve_query(admin).group_by("account_id").all()
    return {str(account_id): n for account_id, n in rows}


@void_api.route("/summary", methods=["GET"])
def summary():
    admin = is_admin()
    data = _summary(
        bool(challenges_visible() and (ctf_started() or admin)),
        bool(accounts_visible()),
        bool(scores_visible()),
        admin,
        _teams_mode(),
    )
    data["mode"] = "teams" if _teams_mode() else "users"
    return jsonify({"success": True, "data": data})


@void_api.route("/solve-counts", methods=["GET"])
def solve_counts():
    if not (scores_visible() and accounts_visible()):
        return jsonify({"success": False, "errors": ["scores are not visible"]}), 403
    return jsonify({"success": True, "data": _solve_counts(is_admin(), _teams_mode())})


def load(app):
    app.register_blueprint(void_api)
