from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
WORKOUTS_FILE = os.path.join(DATA_DIR, 'workouts.json')
READINGS_FILE = os.path.join(DATA_DIR, 'readings.json')

os.makedirs(DATA_DIR, exist_ok=True)


def _load(path):
    if not os.path.exists(path):
        return []
    with open(path, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


@app.route('/')
def home():
    return render_template('index.html')


# ---------- Workouts ----------

@app.route('/api/workouts', methods=['GET'])
def get_workouts():
    return jsonify(_load(WORKOUTS_FILE))


@app.route('/api/workouts', methods=['POST'])
def add_workout():
    body = request.get_json(force=True)
    entry = {
        'id': datetime.now().strftime('%Y%m%d%H%M%S%f'),
        'type': body.get('type', 'strength'),
        'exercise': body.get('exercise', '').strip(),
        'sets': body.get('sets', ''),
        'reps': body.get('reps', ''),
        'weight': body.get('weight', ''),
        'duration': body.get('duration', ''),
        'distance': body.get('distance', ''),
        'steps': body.get('steps', ''),
        'timestamp': datetime.now().isoformat()
    }
    if not entry['exercise']:
        return jsonify({'error': 'exercise name required'}), 400
    data = _load(WORKOUTS_FILE)
    data.insert(0, entry)
    _save(WORKOUTS_FILE, data)
    return jsonify(entry), 201


@app.route('/api/workouts/<entry_id>', methods=['DELETE'])
def delete_workout(entry_id):
    data = _load(WORKOUTS_FILE)
    data = [d for d in data if d['id'] != entry_id]
    _save(WORKOUTS_FILE, data)
    return jsonify({'deleted': entry_id})


# ---------- Health Readings ----------

@app.route('/api/readings', methods=['GET'])
def get_readings():
    return jsonify(_load(READINGS_FILE))


@app.route('/api/readings', methods=['POST'])
def add_reading():
    body = request.get_json(force=True)
    entry = {
        'id': datetime.now().strftime('%Y%m%d%H%M%S%f'),
        'label': body.get('label', '').strip(),
        'value': body.get('value', ''),
        'unit': body.get('unit', ''),
        'note': body.get('note', '').strip(),
        'timestamp': datetime.now().isoformat()
    }
    if not entry['label'] or entry['value'] == '':
        return jsonify({'error': 'label and value required'}), 400
    data = _load(READINGS_FILE)
    data.insert(0, entry)
    _save(READINGS_FILE, data)
    return jsonify(entry), 201


@app.route('/api/readings/<entry_id>', methods=['DELETE'])
def delete_reading(entry_id):
    data = _load(READINGS_FILE)
    data = [d for d in data if d['id'] != entry_id]
    _save(READINGS_FILE, data)
    return jsonify({'deleted': entry_id})


if __name__ == '__main__':
    app.run(debug=True)
