import json
import logging
import os
import re
import threading
import unicodedata
from datetime import datetime, timezone
from uuid import uuid4

from flask import Flask, jsonify, request


log = logging.getLogger("werkzeug")
log.setLevel(logging.ERROR)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_FILE = os.environ.get(
    "ALERTA_DATA_FILE", os.path.join(BASE_DIR, "data", "devices.json")
)
MAX_LOGS = 100
OFFLINE_AFTER_SECONDS = 10

app = Flask(__name__)
state_lock = threading.RLock()


def utc_now():
    return datetime.now(timezone.utc)


def iso_now():
    return utc_now().isoformat()


def empty_state():
    return {"devices": {}, "alerts": [], "logs": []}


def load_state():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as data_file:
            loaded = json.load(data_file)
            loaded.setdefault("devices", {})
            loaded.setdefault("alerts", [])
            loaded.setdefault("logs", [])
            for device in loaded["devices"].values():
                if "activityStartedAt" not in device:
                    device["activityStartedAt"] = (
                        (device.get("statusSince") or device.get("lastSeen"))
                        if device.get("lastSeen") else None
                    )
            return loaded
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return empty_state()


state = load_state()


def save_state():
    directory = os.path.dirname(DATA_FILE)
    os.makedirs(directory, exist_ok=True)
    temporary_file = DATA_FILE + ".tmp"
    with open(temporary_file, "w", encoding="utf-8") as data_file:
        json.dump(state, data_file, ensure_ascii=False, indent=2)
    os.replace(temporary_file, DATA_FILE)


def add_log(log_type, message, device_id=None):
    entry = {
        "id": str(uuid4()),
        "hora": datetime.now().strftime("%H:%M:%S"),
        "timestamp": iso_now(),
        "tipo": log_type,
        "msg": message,
    }
    if device_id:
        entry["deviceId"] = device_id
    state["logs"].insert(0, entry)
    del state["logs"][MAX_LOGS:]


def normalize_device_id(value):
    return re.sub(r"[^a-zA-Z0-9]", "", str(value or "")).lower()


def patient_id_for(device_id):
    return "device-" + normalize_device_id(device_id)


def normalized_text(value):
    text = unicodedata.normalize("NFD", str(value or "").upper())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def sensor_status(raw_status):
    status = normalized_text(raw_status)
    if "QUEDA CONFIRMADA" in status or "APOS QUEDA" in status:
        return "fall_detected"
    if "MOVIMENTO" in status or "ANALISANDO" in status:
        return "moving"
    if "PARADO" in status:
        return "stopped"
    return "offline"


def number_or_none(value, minimum=None, maximum=None):
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if minimum is not None:
        number = max(minimum, number)
    if maximum is not None:
        number = min(maximum, number)
    return number


def new_device(device_id):
    now = iso_now()
    return {
        "id": patient_id_for(device_id),
        "deviceId": str(device_id).upper(),
        "chipId": "",
        "name": "Paciente não vinculado",
        "ward": "Não informado",
        "room": "Não informado",
        "bedId": "",
        "riskLevel": "low",
        "registered": False,
        "battery": None,
        "batteryVoltage": None,
        "wifiSignal": None,
        "rawStatus": "AGUARDANDO DADOS",
        "status": "offline",
        "lastSeen": None,
        "statusSince": now,
        "activityStartedAt": None,
        "checkpoint": None,
        "telemetry": {},
        "fallHistory": [],
        "medicalRecord": None,
        "activeAlertId": None,
        "fallEventActive": False,
        "fallAcknowledgePending": False,
        "resetPending": False,
        "calibrationPending": False,
    }


def get_device_by_patient_id(patient_id):
    for device in state["devices"].values():
        if device.get("id") == patient_id:
            return device
    return None


def effective_status(device):
    last_seen = device.get("lastSeen")
    if not last_seen:
        return "offline"
    try:
        seen_at = datetime.fromisoformat(last_seen)
        if (utc_now() - seen_at).total_seconds() > OFFLINE_AFTER_SECONDS:
            return "offline"
    except (TypeError, ValueError):
        return "offline"
    return device.get("status", "offline")


def activity_seconds(device):
    try:
        # Registros antigos ainda nao tem activityStartedAt; manter o tempo ja
        # exibido ate a proxima telemetria gravar o inicio permanente.
        started_at = device.get("activityStartedAt") or (
            device.get("statusSince") if device.get("lastSeen") else None
        )
        started = datetime.fromisoformat(started_at)
        return max(0, int((utc_now() - started).total_seconds()))
    except (TypeError, ValueError):
        return 0


def falls_this_month(device):
    now = datetime.now()
    prefix = now.strftime("%m/%Y")
    return sum(
        1
        for fall in device.get("fallHistory", [])
        if str(fall.get("date", "")).endswith(prefix)
    )


def public_calibration(device):
    calibration = device.get("calibration")
    if not calibration:
        return None
    result = dict(calibration)
    if result["status"] in ("pending", "running"):
        age = (utc_now() - datetime.fromisoformat(result["requestedAt"])).total_seconds()
        if age > 30:
            result["status"] = "timeout"
    return result


def public_device(device):
    return {
        "id": device["id"],
        "name": device.get("name", "Paciente não vinculado"),
        "ward": device.get("ward", "Não informado"),
        "room": device.get("room", "Não informado"),
        "status": effective_status(device),
        "riskLevel": device.get("riskLevel", "low"),
        "deviceId": device.get("deviceId", ""),
        "chipId": device.get("chipId") or None,
        "battery": device.get("battery"),
        "batteryVoltage": device.get("batteryVoltage"),
        "calibration": public_calibration(device),
        "wifiSignal": device.get("wifiSignal"),
        "bedId": device.get("bedId") or None,
        "lastUpdate": device.get("lastSeen"),
        "rawStatus": device.get("rawStatus"),
        "checkpoint": device.get("checkpoint"),
        "activityDurationSeconds": activity_seconds(device),
        "fallsThisMonth": falls_this_month(device),
        "fallHistory": device.get("fallHistory", []),
        "medicalRecord": device.get("medicalRecord"),
        "registered": bool(device.get("registered")),
        "telemetry": device.get("telemetry", {}),
    }


def error_response(message, status_code=400):
    return jsonify({"status": "error", "message": message}), status_code


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = os.environ.get(
        "ALERTA_FRONTEND_ORIGIN", "*"
    )
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
    return response


@app.route("/")
def index():
    return jsonify(
        {
            "name": "ALERTA API",
            "status": "online",
            "endpoints": {
                "patients": "/api/patients",
                "devices": "/api/devices",
                "sensor": "/api/sensor",
                "alerts": "/api/alerts",
            },
        }
    )


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "online", "timestamp": iso_now()}), 200


@app.route("/api/logs", methods=["GET"])
def get_logs():
    with state_lock:
        return jsonify(state["logs"]), 200


@app.route("/api/patients", methods=["GET"])
def get_patients():
    with state_lock:
        patients = [
            public_device(device)
            for device in state["devices"].values()
            if device.get("registered")
        ]
        patients.sort(key=lambda patient: patient["name"].lower())
        return jsonify(patients), 200


@app.route("/api/patients/<patient_id>", methods=["GET", "PATCH", "DELETE"])
def patient_detail(patient_id):
    with state_lock:
        device = get_device_by_patient_id(patient_id)
        if not device:
            return error_response("Paciente/dispositivo não encontrado.", 404)

        if request.method == "GET":
            return jsonify(public_device(device)), 200

        if request.method == "DELETE":
            device.update(
                {
                    "name": "Paciente não vinculado",
                    "ward": "Não informado",
                    "room": "Não informado",
                    "bedId": "",
                    "riskLevel": "low",
                    "medicalRecord": None,
                    "registered": False,
                }
            )
            add_log("COMANDO", "Colete desvinculado do paciente.", device["deviceId"])
            save_state()
            return jsonify({"status": "success"}), 200

        data = request.get_json(silent=True) or {}
        medical_record = data.get("medicalRecord")
        if medical_record is not None:
            if not isinstance(medical_record, dict):
                return error_response("medicalRecord deve ser um objeto.")
            risk_level = medical_record.get("riskLevel", device.get("riskLevel", "low"))
            if risk_level not in ("low", "medium", "high"):
                return error_response("Grau de risco inválido.")
            device["riskLevel"] = risk_level
            device["medicalRecord"] = {
                "riskLevel": risk_level,
                "responsible": str(medical_record.get("responsible", "")).strip(),
                "observations": str(medical_record.get("observations", "")).strip(),
            }
        save_state()
        return jsonify(public_device(device)), 200


@app.route("/api/patients/<patient_id>/record", methods=["DELETE"])
def delete_patient_record(patient_id):
    with state_lock:
        device = get_device_by_patient_id(patient_id)
        if not device:
            return error_response("Registro do paciente não encontrado.", 404)

        device_key = next(
            key for key, candidate in state["devices"].items() if candidate is device
        )
        device_id = device.get("deviceId")
        state["alerts"] = [
            alert
            for alert in state["alerts"]
            if alert.get("patientId") != patient_id
        ]
        state["logs"] = [
            entry
            for entry in state["logs"]
            if entry.get("deviceId") != device_id
        ]
        del state["devices"][device_key]
        save_state()
        return jsonify({"status": "success"}), 200


@app.route("/api/devices", methods=["POST"])
def register_device():
    data = request.get_json(silent=True) or {}
    device_id = str(data.get("deviceId") or data.get("mac") or "").strip()
    patient_name = str(data.get("patientName") or "").strip()
    if not normalize_device_id(device_id):
        return error_response("Informe o MAC/ID do dispositivo.")
    if not patient_name:
        return error_response("Informe o nome do paciente.")

    risk_level = data.get("riskLevel", "low")
    if risk_level not in ("low", "medium", "high"):
        return error_response("Grau de risco inválido.")

    key = normalize_device_id(device_id)
    with state_lock:
        device = state["devices"].get(key) or new_device(device_id)
        device.update(
            {
                "deviceId": device_id.upper(),
                "chipId": str(data.get("chipId") or "").strip(),
                "name": patient_name,
                "ward": str(data.get("ward") or "Não informado").strip(),
                "room": str(data.get("room") or "Não informado").strip(),
                "bedId": str(data.get("bedId") or "").strip(),
                "riskLevel": risk_level,
                "registered": True,
            }
        )
        state["devices"][key] = device
        add_log("INFO", f"Dispositivo vinculado a {patient_name}.", device["deviceId"])
        save_state()
        return jsonify(public_device(device)), 201


@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    requested_status = request.args.get("status")
    with state_lock:
        alerts = state["alerts"]
        if requested_status:
            alerts = [alert for alert in alerts if alert.get("status") == requested_status]
        return jsonify(alerts), 200


@app.route("/api/alerts/<alert_id>", methods=["PATCH"])
def update_alert(alert_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if new_status not in ("responded", "dismissed"):
        return error_response("Status do alerta inválido.")

    with state_lock:
        alert = next((item for item in state["alerts"] if item["id"] == alert_id), None)
        if not alert:
            return error_response("Alerta não encontrado.", 404)
        alert["status"] = new_status
        alert["resolvedAt"] = iso_now()
        device = get_device_by_patient_id(alert["patientId"])
        if device and device.get("activeAlertId") == alert_id:
            device["activeAlertId"] = None
            device["fallAcknowledgePending"] = True
            if device.get("status") != "stopped":
                device["status"] = "stopped"
                device["statusSince"] = iso_now()
        add_log(
            "COMANDO",
            "Alerta atendido." if new_status == "responded" else "Alerta marcado como falso.",
            device.get("deviceId") if device else None,
        )
        save_state()
        return jsonify(alert), 200


@app.route("/api/devices/<patient_id>/calibrate", methods=["POST"])
def schedule_device_calibration(patient_id):
    with state_lock:
        device = get_device_by_patient_id(patient_id)
        if not device:
            return error_response("Dispositivo não encontrado.", 404)
        if effective_status(device) == "offline":
            return error_response("Conecte o dispositivo antes de calibrar.", 409)
        previous = public_calibration(device)
        if previous and previous["status"] in ("pending", "running"):
            return error_response("Já existe uma calibração em andamento.", 409)
        device["calibration"] = {
            "id": str(uuid4()), "status": "pending", "durationMs": 10000,
            "requestedAt": iso_now(), "startedAt": None,
        }
        device["calibrationPending"] = True
        add_log("COMANDO", "Calibração solicitada para a placa.", device["deviceId"])
        save_state()
        return jsonify(device["calibration"]), 200


@app.route("/api/calibration", methods=["POST"])
def report_calibration():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or data.get("status") not in ("running", "completed", "failed"):
        return error_response("Resultado de calibração inválido.")
    with state_lock:
        device = state["devices"].get(normalize_device_id(data.get("deviceId")))
        calibration = public_calibration(device) if device else None
        if not calibration or calibration["id"] != data.get("calibrationId"):
            return error_response("Calibração não encontrada.", 404)
        # Repetir uma confirmação é seguro; resultados atrasados não mudam outra solicitação.
        if calibration["status"] == data["status"]:
            return jsonify(calibration), 200
        if calibration["status"] not in ("pending", "running"):
            return error_response("Calibração já encerrada.", 409)
        if data["status"] == "completed" and calibration["status"] != "running":
            return error_response("Calibração ainda não iniciada.", 409)
        calibration["status"] = data["status"]
        if data["status"] == "running":
            calibration["startedAt"] = iso_now()
        else:
            calibration["finishedAt"] = iso_now()
        device["calibration"] = calibration
        device["calibrationPending"] = False
        save_state()
        return jsonify(calibration), 200


@app.route("/api/devices/<patient_id>/reset", methods=["POST"])
def schedule_device_reset(patient_id):
    with state_lock:
        device = get_device_by_patient_id(patient_id)
        if not device:
            return error_response("Dispositivo não encontrado.", 404)
        device["resetPending"] = True
        add_log("COMANDO", "Ordem de reset enviada para a placa.", device["deviceId"])
        save_state()
        return jsonify({"status": "success", "message": "Reset agendado"}), 200


@app.route("/api/trigger-reset", methods=["POST"])
def trigger_reset_compatibility():
    data = request.get_json(silent=True) or {}
    device_id = normalize_device_id(data.get("deviceId"))
    with state_lock:
        if device_id and device_id in state["devices"]:
            device = state["devices"][device_id]
        elif len(state["devices"]) == 1:
            device = next(iter(state["devices"].values()))
        else:
            return error_response("Informe o deviceId do dispositivo.")
        device["resetPending"] = True
        add_log("COMANDO", "Ordem de reset enviada para a placa.", device["deviceId"])
        save_state()
        return jsonify({"status": "success", "message": "Reset agendado"}), 200


@app.route("/api/checkpoint", methods=["POST"])
def checkpoint():
    data = request.get_json(silent=True) or {}
    device_id = str(data.get("deviceId") or "").strip()
    if not normalize_device_id(device_id):
        return error_response("deviceId é obrigatório.")
    with state_lock:
        key = normalize_device_id(device_id)
        device = state["devices"].get(key) or new_device(device_id)
        device["lastSeen"] = iso_now()
        device["checkpoint"] = data.get("checkpoint")
        state["devices"][key] = device
        save_state()
    return jsonify({"status": "success", "message": "Checkpoint recebido"}), 200


@app.route("/api/sensor", methods=["POST"])
def sensor_data():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("Envie um objeto JSON válido.")

    device_id = str(data.get("deviceId") or "").strip()
    raw_status = str(data.get("status") or "").strip()
    if not normalize_device_id(device_id):
        return error_response("deviceId é obrigatório.")
    if not raw_status:
        return error_response("status é obrigatório.")

    key = normalize_device_id(device_id)
    with state_lock:
        device = state["devices"].get(key) or new_device(device_id)
        incoming_status = sensor_status(raw_status)
        is_new_fall = (
            incoming_status == "fall_detected"
            and not device.get("fallEventActive")
            and not device.get("activeAlertId")
            and bool(device.get("registered"))
        )

        if incoming_status == "fall_detected":
            device["fallEventActive"] = True
        else:
            device["fallEventActive"] = False

        device["deviceId"] = device_id.upper()
        if data.get("chipId"):
            device["chipId"] = str(data["chipId"])
        if not device.get("activityStartedAt"):
            device["activityStartedAt"] = (
                device.get("statusSince") if device.get("lastSeen") else iso_now()
            )
        device["lastSeen"] = iso_now()
        device["rawStatus"] = raw_status
        device["checkpoint"] = data.get("checkpoint")
        device["battery"] = number_or_none(data.get("battery"), 0, 100)
        device["batteryVoltage"] = number_or_none(data.get("batteryVoltage"), 0, 10)
        device["wifiSignal"] = number_or_none(data.get("wifiRssi"), -150, 0)
        device["telemetry"] = {
            "accelX": number_or_none(data.get("accelX")),
            "accelY": number_or_none(data.get("accelY")),
            "accelZ": number_or_none(data.get("accelZ")),
            "gyroX": number_or_none(data.get("gyroX")),
            "gyroY": number_or_none(data.get("gyroY")),
            "gyroZ": number_or_none(data.get("gyroZ")),
            "accMagnitude": number_or_none(data.get("accMagnitude")),
            "gyroMagnitude": number_or_none(data.get("gyroMagnitude")),
            "deviceTimestamp": data.get("timestamp"),
        }

        if is_new_fall:
            detected_at = iso_now()
            local_time = datetime.now()
            alert = {
                "id": str(uuid4()),
                "patientId": device["id"],
                "patientName": device.get("name", "Paciente não vinculado"),
                "location": f"{device.get('ward', 'Não informado')} • {device.get('room', 'Não informado')}",
                "deviceId": device["deviceId"],
                "detectedAt": detected_at,
                "status": "pending",
            }
            state["alerts"].insert(0, alert)
            device["activeAlertId"] = alert["id"]
            device.setdefault("fallHistory", []).insert(
                0,
                {
                    "date": local_time.strftime("%d/%m/%Y"),
                    "time": local_time.strftime("%H:%M"),
                },
            )
            add_log(
                "ALERTA",
                f"QUEDA DETECTADA: {raw_status} | Aceleração: {data.get('accMagnitude')} m/s²",
                device["deviceId"],
            )
        elif incoming_status != "fall_detected":
            add_log("INFO", f"Status: {raw_status}", device["deviceId"])

        presentation_status = "fall_detected" if device.get("activeAlertId") else incoming_status
        if incoming_status == "fall_detected" and not is_new_fall and not device.get("activeAlertId"):
            presentation_status = "stopped"
        if device.get("status") != presentation_status:
            device["status"] = presentation_status
            device["statusSince"] = iso_now()

        reset_requested = bool(device.get("resetPending"))
        calibration = public_calibration(device)
        calibration_requested = bool(device.get("calibrationPending")) and not reset_requested and bool(calibration and calibration["status"] == "pending")
        calibration_id = calibration["id"] if calibration_requested else None
        if reset_requested and calibration and calibration["status"] in ("pending", "running"):
            device["calibration"]["status"] = "failed"
        if calibration_requested or reset_requested:
            # Reiniciar já executa a calibração na inicialização.
            device["calibrationPending"] = False
        if reset_requested:
            device["resetPending"] = False

        fall_acknowledged = bool(device.get("fallAcknowledgePending"))
        if fall_acknowledged:
            device["fallAcknowledgePending"] = False

        state["devices"][key] = device
        save_state()

    return jsonify(
        {
            "status": "success",
            "reset": reset_requested,
            "calibrate": calibration_requested,
            "calibrationId": calibration_id,
            "acknowledgeFall": fall_acknowledged,
        }
    ), 200


if not state["logs"]:
    with state_lock:
        add_log("INFO", "Servidor iniciado. Aguardando dados dos dispositivos.")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False, threaded=True)
