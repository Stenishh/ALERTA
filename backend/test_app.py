import os
import tempfile
import unittest


test_data = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
test_data.close()
os.environ["ALERTA_DATA_FILE"] = test_data.name

import app as backend  # noqa: E402


class AlertApiTest(unittest.TestCase):
    def setUp(self):
        backend.state = backend.empty_state()
        self.client = backend.app.test_client()

    def tearDown(self):
        try:
            os.unlink(test_data.name)
        except FileNotFoundError:
            pass

    def register_device(self):
        response = self.client.post(
            "/api/devices",
            json={
                "deviceId": "AA:BB:CC:DD:EE:FF",
                "patientName": "Paciente Teste",
                "ward": "Ala A",
                "room": "101",
                "riskLevel": "medium",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def test_sensor_updates_patient_and_battery(self):
        patient = self.register_device()
        response = self.client.post(
            "/api/sensor",
            json={
                "deviceId": "AA:BB:CC:DD:EE:FF",
                "status": "EM MOVIMENTO",
                "checkpoint": 7,
                "battery": 73,
                "batteryVoltage": 3.91,
                "wifiRssi": -64,
                "accMagnitude": 2.5,
            },
        )
        self.assertEqual(response.status_code, 200)

        current = self.client.get(f"/api/patients/{patient['id']}").get_json()
        self.assertEqual(current["status"], "moving")
        self.assertEqual(current["battery"], 73)
        self.assertEqual(current["wifiSignal"], -64)

    def test_fall_creates_one_pending_alert(self):
        self.register_device()
        payload = {
            "deviceId": "AA:BB:CC:DD:EE:FF",
            "status": "QUEDA CONFIRMADA",
            "checkpoint": 8,
            "battery": 70,
            "batteryVoltage": 3.9,
            "wifiRssi": -65,
            "accMagnitude": 22.4,
        }
        self.client.post("/api/sensor", json=payload)
        self.client.post("/api/sensor", json=payload)

        alerts = self.client.get("/api/alerts?status=pending").get_json()
        self.assertEqual(len(alerts), 1)

        resolved = self.client.patch(
            f"/api/alerts/{alerts[0]['id']}", json={"status": "responded"}
        )
        self.assertEqual(resolved.status_code, 200)
        self.assertEqual(
            self.client.get("/api/alerts?status=pending").get_json(), []
        )

        current = self.client.get("/api/patients/device-aabbccddeeff").get_json()
        self.assertEqual(current["status"], "stopped")

        first_sensor_response = self.client.post("/api/sensor", json=payload).get_json()
        second_sensor_response = self.client.post("/api/sensor", json=payload).get_json()
        self.assertTrue(first_sensor_response["acknowledgeFall"])
        self.assertFalse(second_sensor_response["acknowledgeFall"])
        self.assertEqual(
            self.client.get("/api/alerts?status=pending").get_json(), []
        )

    def test_calibration_requires_online_device_and_is_delivered_once(self):
        patient = self.register_device()
        url = f"/api/devices/{patient['id']}/calibrate"
        self.assertEqual(self.client.post(url).status_code, 409)
        payload = {"deviceId": patient["deviceId"], "status": "PARADO"}
        self.client.post("/api/sensor", json=payload)
        self.assertEqual(self.client.post(url).status_code, 200)
        first = self.client.post("/api/sensor", json=payload).get_json()
        second = self.client.post("/api/sensor", json=payload).get_json()
        self.assertTrue(first["calibrate"])
        self.assertFalse(first["reset"])
        self.assertFalse(second["calibrate"])
        self.assertEqual(self.client.post("/api/devices/missing/calibrate").status_code, 404)

    def test_reset_supersedes_pending_calibration(self):
        patient = self.register_device()
        payload = {"deviceId": patient["deviceId"], "status": "PARADO"}
        self.client.post("/api/sensor", json=payload)
        self.client.post(f"/api/devices/{patient['id']}/calibrate")
        self.client.post(f"/api/devices/{patient['id']}/reset")
        first = self.client.post("/api/sensor", json=payload).get_json()
        second = self.client.post("/api/sensor", json=payload).get_json()
        self.assertTrue(first["reset"])
        self.assertFalse(first["calibrate"])
        self.assertFalse(second["calibrate"])

    def test_calibration_progress_and_result_match_the_request(self):
        patient = self.register_device()
        payload = {"deviceId": patient["deviceId"], "status": "PARADO"}
        self.client.post("/api/sensor", json=payload)
        url = f"/api/devices/{patient['id']}/calibrate"
        job = self.client.post(url).get_json()
        self.assertEqual(job["status"], "pending")
        self.assertEqual(self.client.post(url).status_code, 409)
        reply = self.client.post("/api/sensor", json=payload).get_json()
        self.assertEqual(reply["calibrationId"], job["id"])
        report = {"deviceId": patient["deviceId"], "calibrationId": job["id"], "status": "completed"}
        self.assertEqual(self.client.post("/api/calibration", json=report).status_code, 409)
        report["status"] = "running"
        started = self.client.post("/api/calibration", json=report).get_json()
        self.assertIsNotNone(started["startedAt"])
        self.assertEqual(self.client.post("/api/calibration", json=report).get_json()["startedAt"], started["startedAt"])
        report["status"] = "completed"
        self.assertEqual(self.client.post("/api/calibration", json=report).status_code, 200)
        self.assertEqual(self.client.post("/api/calibration", json=report).status_code, 200)
        current = self.client.get(f"/api/patients/{patient['id']}").get_json()
        self.assertEqual(current["calibration"]["status"], "completed")
        next_job = self.client.post(url).get_json()
        self.assertNotEqual(job["id"], next_job["id"])
        self.assertEqual(self.client.post("/api/calibration", json=report).status_code, 404)
        report.update(calibrationId=next_job["id"], status="failed")
        self.assertEqual(self.client.post("/api/calibration", json=report).get_json()["status"], "failed")

    def test_calibration_timeout_does_not_report_success(self):
        patient = self.register_device()
        payload = {"deviceId": patient["deviceId"], "status": "PARADO"}
        self.client.post("/api/sensor", json=payload)
        self.client.post(f"/api/devices/{patient['id']}/calibrate")
        device = backend.get_device_by_patient_id(patient["id"])
        device["calibration"]["requestedAt"] = "2000-01-01T00:00:00+00:00"
        current = self.client.get(f"/api/patients/{patient['id']}").get_json()
        self.assertEqual(current["calibration"]["status"], "timeout")
        reply = self.client.post("/api/sensor", json=payload).get_json()
        self.assertFalse(reply["calibrate"])
        report = {"deviceId": patient["deviceId"], "calibrationId": device["calibration"]["id"], "status": "completed"}
        self.assertEqual(self.client.post("/api/calibration", json=report).status_code, 409)

    def test_reset_is_delivered_in_next_sensor_response(self):
        patient = self.register_device()
        scheduled = self.client.post(f"/api/devices/{patient['id']}/reset")
        self.assertEqual(scheduled.status_code, 200)

        payload = {
            "deviceId": "AA:BB:CC:DD:EE:FF",
            "status": "PARADO",
            "checkpoint": 9,
            "battery": 68,
            "batteryVoltage": 3.87,
            "wifiRssi": -62,
        }
        first_response = self.client.post("/api/sensor", json=payload).get_json()
        second_response = self.client.post("/api/sensor", json=payload).get_json()
        self.assertTrue(first_response["reset"])
        self.assertFalse(second_response["reset"])

    def test_post_fall_status_opens_only_one_alert_until_normal(self):
        self.register_device()
        post_fall_payload = {
            "deviceId": "AA:BB:CC:DD:EE:FF",
            "status": "PARADO APOS QUEDA",
            "checkpoint": 10,
            "battery": 65,
            "batteryVoltage": 3.8,
            "wifiRssi": -58,
        }

        self.client.post("/api/sensor", json=post_fall_payload)
        alerts = self.client.get("/api/alerts?status=pending").get_json()
        self.assertEqual(len(alerts), 1)

        self.client.patch(
            f"/api/alerts/{alerts[0]['id']}", json={"status": "responded"}
        )
        acknowledged = self.client.post(
            "/api/sensor", json=post_fall_payload
        ).get_json()
        self.assertTrue(acknowledged["acknowledgeFall"])
        self.client.post("/api/sensor", json=post_fall_payload)
        self.assertEqual(
            self.client.get("/api/alerts?status=pending").get_json(), []
        )

        normal_payload = {**post_fall_payload, "status": "PARADO", "checkpoint": 11}
        self.client.post("/api/sensor", json=normal_payload)
        self.client.post("/api/sensor", json=post_fall_payload)
        self.assertEqual(
            len(self.client.get("/api/alerts?status=pending").get_json()),
            1,
        )

    def test_patient_record_can_be_deleted(self):
        patient = self.register_device()
        response = self.client.delete(f"/api/patients/{patient['id']}/record")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/patients").get_json(), [])
        self.assertEqual(
            self.client.get(f"/api/patients/{patient['id']}").status_code,
            404,
        )


if __name__ == "__main__":
    unittest.main()
