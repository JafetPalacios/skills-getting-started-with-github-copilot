from importlib import import_module

from fastapi.testclient import TestClient

app_module = import_module("src.app")
client = TestClient(app_module.app)


def test_unregister_participant_from_activity():
    activity_name = "Chess Club"
    email = "newstudent@mergington.edu"

    if email in app_module.activities[activity_name]["participants"]:
        app_module.activities[activity_name]["participants"].remove(email)

    signup_response = client.post(f"/activities/{activity_name}/signup?email={email}")
    assert signup_response.status_code == 200

    delete_response = client.delete(f"/activities/{activity_name}/signup?email={email}")
    assert delete_response.status_code == 200
    assert email not in app_module.activities[activity_name]["participants"]
