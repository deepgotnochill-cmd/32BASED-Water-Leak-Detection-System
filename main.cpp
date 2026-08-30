#include <Arduino.h>

// Simulation-only communication abstraction.
// This demo passes synthetic node-to-node data in software so it remains easy to
// run in Wokwi. Later, the same structure can be replaced with real ESP-NOW or
// UART-based communication between physical sensor nodes.

const int NODE_COUNT = 4;
const int HISTORY_SAMPLES = 6;

const char SCENARIO_NORMAL = 'N';
const char SCENARIO_BC = 'B';
const char SCENARIO_CD = 'C';
const char SCENARIO_TRANSIENT = 'T';

enum NodeState {
  NODE_STATUS_NORMAL,
  NODE_STATUS_POTENTIAL,
  NODE_STATUS_CONFIRMED,
  NODE_STATUS_TRANSIENT
};

struct NodeSample {
  float flow;
  float pressure;
  float flowAverage;
  float pressureAverage;
  float flowDeviation;
  float pressureDeviation;
  int persistence;
  NodeState state;
  bool active;
  bool abnormal;
};

struct SystemResult {
  bool leakDetected;
  String zone;
  float confidence;
  String reason;
};

struct LinkMessage {
  int sender;
  int receiver;
  float flow;
  float pressure;
};

LinkMessage simulateNodeMessage(int sender, int receiver, float flow, float pressure) {
  LinkMessage message;
  message.sender = sender;
  message.receiver = receiver;
  message.flow = flow;
  message.pressure = pressure;
  return message;
}

const String NODE_NAMES[NODE_COUNT] = {"A", "B", "C", "D"};
const String SCENARIO_LABELS[4] = {"NORMAL", "LEAK B-C", "LEAK C-D", "TRANSIENT"};
const float BASELINE_FLOW[NODE_COUNT] = {20.0f, 20.0f, 20.0f, 20.0f};
const float BASELINE_PRESSURE[NODE_COUNT] = {3.3f, 3.3f, 3.3f, 3.3f};

char currentScenario = SCENARIO_NORMAL;
float flowHistory[NODE_COUNT][HISTORY_SAMPLES] = {{0}};
float pressureHistory[NODE_COUNT][HISTORY_SAMPLES] = {{0}};
int historyIndex = 0;
NodeSample nodes[NODE_COUNT];

String stateName(NodeState state) {
  switch (state) {
    case NODE_STATUS_NORMAL:
      return "NORMAL";
    case NODE_STATUS_POTENTIAL:
      return "POTENTIAL ANOMALY";
    case NODE_STATUS_CONFIRMED:
      return "CONFIRMED LEAK";
    case NODE_STATUS_TRANSIENT:
      return "TRANSIENT DISTURBANCE";
    default:
      return "NORMAL";
  }
}

void setScenario(char newScenario) {
  switch (newScenario) {
    case SCENARIO_NORMAL:
    case SCENARIO_BC:
    case SCENARIO_CD:
    case SCENARIO_TRANSIENT:
      currentScenario = newScenario;
      break;
    default:
      currentScenario = SCENARIO_NORMAL;
      break;
  }
}

void setNodeStatus(int index, NodeState state) {
  nodes[index].state = state;
  nodes[index].abnormal = (state != NODE_STATUS_NORMAL);
}

float movingAverage(float values[], int count) {
  float total = 0.0f;
  for (int i = 0; i < count; i++) {
    total += values[i];
  }
  if (count == 0) {
    return 0.0f;
  }
  return total / count;
}

void readSensors() {
  int flowTrim = analogRead(34);
  int pressureTrim = analogRead(35);
  float flowBias = (float)flowTrim / 4095.0f;
  float pressureBias = (float)pressureTrim / 4095.0f;

  for (int i = 0; i < NODE_COUNT; i++) {
    nodes[i].flow = BASELINE_FLOW[i];
    nodes[i].pressure = BASELINE_PRESSURE[i];

    if (currentScenario == SCENARIO_NORMAL) {
      nodes[i].flow = BASELINE_FLOW[i] + (flowBias * 0.35f) - 0.18f;
      nodes[i].pressure = BASELINE_PRESSURE[i] + (pressureBias * 0.18f) - 0.09f;
    } else if (currentScenario == SCENARIO_BC) {
      if (i == 0) {
        nodes[i].flow = 20.1f + (flowBias * 0.2f);
        nodes[i].pressure = 3.4f + (pressureBias * 0.1f);
      } else if (i == 1) {
        nodes[i].flow = 17.2f + (flowBias * 0.15f);
        nodes[i].pressure = 2.8f + (pressureBias * 0.08f);
      } else if (i == 2) {
        nodes[i].flow = 16.9f + (flowBias * 0.15f);
        nodes[i].pressure = 2.7f + (pressureBias * 0.08f);
      } else {
        nodes[i].flow = 20.0f + (flowBias * 0.2f);
        nodes[i].pressure = 3.3f + (pressureBias * 0.1f);
      }
    } else if (currentScenario == SCENARIO_CD) {
      if (i == 0) {
        nodes[i].flow = 20.2f + (flowBias * 0.2f);
        nodes[i].pressure = 3.4f + (pressureBias * 0.1f);
      } else if (i == 1) {
        nodes[i].flow = 19.7f + (flowBias * 0.15f);
        nodes[i].pressure = 3.2f + (pressureBias * 0.08f);
      } else if (i == 2) {
        nodes[i].flow = 17.1f + (flowBias * 0.15f);
        nodes[i].pressure = 2.8f + (pressureBias * 0.08f);
      } else {
        nodes[i].flow = 16.8f + (flowBias * 0.15f);
        nodes[i].pressure = 2.6f + (pressureBias * 0.08f);
      }
    } else if (currentScenario == SCENARIO_TRANSIENT) {
      if (i == 1) {
        nodes[i].flow = 18.8f + (flowBias * 0.2f);
        nodes[i].pressure = 3.1f + (pressureBias * 0.1f);
      } else {
        nodes[i].flow = BASELINE_FLOW[i] + (flowBias * 0.25f) - 0.12f;
        nodes[i].pressure = BASELINE_PRESSURE[i] + (pressureBias * 0.12f) - 0.06f;
      }
    }

    flowHistory[i][historyIndex % HISTORY_SAMPLES] = nodes[i].flow;
    pressureHistory[i][historyIndex % HISTORY_SAMPLES] = nodes[i].pressure;

    nodes[i].flowAverage = movingAverage(flowHistory[i], HISTORY_SAMPLES);
    nodes[i].pressureAverage = movingAverage(pressureHistory[i], HISTORY_SAMPLES);

    nodes[i].flowDeviation = abs(nodes[i].flow - BASELINE_FLOW[i]) / BASELINE_FLOW[i];
    nodes[i].pressureDeviation = abs(nodes[i].pressure - BASELINE_PRESSURE[i]) / BASELINE_PRESSURE[i];

    LinkMessage link = simulateNodeMessage(i, (i + 1) % NODE_COUNT, nodes[i].flow, nodes[i].pressure);
    (void)link;
  }

  historyIndex++;
}

void calculateStatistics() {
  for (int i = 0; i < NODE_COUNT; i++) {
    nodes[i].active = (nodes[i].flowDeviation > 0.06f) || (nodes[i].pressureDeviation > 0.06f);
    nodes[i].abnormal = false;
    nodes[i].persistence = 0;
  }
}

void detectAnomaly() {
  for (int i = 0; i < NODE_COUNT; i++) {
    bool flowSuspicious = nodes[i].flowDeviation > 0.10f || (abs(nodes[i].flow - nodes[i].flowAverage) / max(1.0f, nodes[i].flowAverage)) > 0.06f;
    bool pressureSuspicious = nodes[i].pressureDeviation > 0.10f || (abs(nodes[i].pressure - nodes[i].pressureAverage) / max(1.0f, nodes[i].pressureAverage)) > 0.06f;

    if (flowSuspicious || pressureSuspicious) {
      nodes[i].persistence += 1;
    } else {
      nodes[i].persistence = 0;
    }

    if (currentScenario == SCENARIO_TRANSIENT && nodes[i].persistence == 1) {
      setNodeStatus(i, NODE_STATUS_TRANSIENT);
    } else if (nodes[i].persistence >= 2) {
      setNodeStatus(i, NODE_STATUS_CONFIRMED);
    } else if (nodes[i].persistence == 1) {
      setNodeStatus(i, NODE_STATUS_POTENTIAL);
    } else {
      setNodeStatus(i, NODE_STATUS_NORMAL);
    }
  }
}

void filterTransient() {
  for (int i = 0; i < NODE_COUNT; i++) {
    if (currentScenario == SCENARIO_TRANSIENT && nodes[i].state == NODE_STATUS_POTENTIAL) {
      nodes[i].state = NODE_STATUS_TRANSIENT;
      nodes[i].abnormal = true;
    }
    if (currentScenario != SCENARIO_TRANSIENT && nodes[i].state == NODE_STATUS_TRANSIENT) {
      nodes[i].state = NODE_STATUS_NORMAL;
      nodes[i].abnormal = false;
    }
  }
}

SystemResult localizeLeak() {
  SystemResult result = {false, "NONE", 0.0f, "No abnormal sustained pattern detected."};

  bool bAndCAbnormal = (nodes[1].state != NODE_STATUS_NORMAL) && (nodes[2].state != NODE_STATUS_NORMAL);
  bool aAndDNormal = (nodes[0].state == NODE_STATUS_NORMAL) && (nodes[3].state == NODE_STATUS_NORMAL);

  bool cAndDAbnormal = (nodes[2].state != NODE_STATUS_NORMAL) && (nodes[3].state != NODE_STATUS_NORMAL);
  bool bAndAOk = (nodes[1].state == NODE_STATUS_NORMAL) && (nodes[0].state == NODE_STATUS_NORMAL);

  if (currentScenario == SCENARIO_TRANSIENT) {
    result.leakDetected = false;
    result.zone = "NONE";
    result.confidence = 18.0f;
    result.reason = "Temporary fluctuation fell below sustained-leak threshold.";
    return result;
  }

  if (bAndCAbnormal && aAndDNormal) {
    result.leakDetected = true;
    result.zone = "NODE B → NODE C";
    result.confidence = 87.0f;
    result.reason = "Sustained correlated anomaly detected at Node B and Node C.";
    return result;
  }

  if (cAndDAbnormal && bAndAOk) {
    result.leakDetected = true;
    result.zone = "NODE C → NODE D";
    result.confidence = 82.0f;
    result.reason = "Sustained correlated anomaly detected at Node C and Node D.";
    return result;
  }

  if (nodes[1].state == NODE_STATUS_CONFIRMED && nodes[2].state == NODE_STATUS_CONFIRMED) {
    result.leakDetected = true;
    result.zone = "NODE B → NODE C";
    result.confidence = 90.0f;
    result.reason = "Confirmed leak pattern between the two strongest anomaly peaks.";
    return result;
  }

  if (nodes[2].state == NODE_STATUS_CONFIRMED && nodes[3].state == NODE_STATUS_CONFIRMED) {
    result.leakDetected = true;
    result.zone = "NODE C → NODE D";
    result.confidence = 86.0f;
    result.reason = "Confirmed leak pattern between the downstream nodes.";
    return result;
  }

  return result;
}

void printStatus() {
  SystemResult leakResult = localizeLeak();

  Serial.println("========================================");
  Serial.print("Scenario: ");
  Serial.println((currentScenario == SCENARIO_NORMAL) ? "NORMAL" :
                 (currentScenario == SCENARIO_BC) ? "LEAK B-C" :
                 (currentScenario == SCENARIO_CD) ? "LEAK C-D" : "TRANSIENT");
  Serial.println();

  for (int i = 0; i < NODE_COUNT; i++) {
    Serial.print("NODE ");
    Serial.println(NODE_NAMES[i]);
    Serial.print("Flow: ");
    Serial.print(nodes[i].flow, 1);
    Serial.println(" L/min");
    Serial.print("Pressure: ");
    Serial.print(nodes[i].pressure, 1);
    Serial.println(" bar");
    Serial.print("Status: ");
    Serial.println(stateName(nodes[i].state));
    Serial.println();
  }

  Serial.print("Leak: ");
  Serial.println(leakResult.leakDetected ? "DETECTED" : "NOT DETECTED");
  Serial.print("Zone: ");
  Serial.println(leakResult.zone);
  Serial.print("Confidence: ");
  Serial.print(leakResult.confidence, 0);
  Serial.println("%");
  Serial.println();
  Serial.println("Reason:");
  Serial.println(leakResult.reason);
  Serial.println("========================================");
  Serial.println();

  digitalWrite(25, leakResult.leakDetected ? HIGH : LOW);
  digitalWrite(18, nodes[0].state == NODE_STATUS_NORMAL ? LOW : HIGH);
  digitalWrite(19, nodes[1].state == NODE_STATUS_NORMAL ? LOW : HIGH);
  digitalWrite(21, nodes[2].state == NODE_STATUS_NORMAL ? LOW : HIGH);
  digitalWrite(22, nodes[3].state == NODE_STATUS_NORMAL ? LOW : HIGH);

  if (leakResult.leakDetected) {
    tone(26, 800, 150);
  } else {
    noTone(26);
  }
}

void handleSerialCommand() {
  if (Serial.available() > 0) {
    String command = Serial.readString();
    command.trim();
    if (command.length() > 0) {
      char selected = command.charAt(0);
      setScenario(selected);
      Serial.print("Scenario switched to: ");
      Serial.println(SCENARIO_LABELS[(selected == 'N') ? 0 : (selected == 'B') ? 1 : (selected == 'C') ? 2 : 3]);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(18, OUTPUT);
  pinMode(19, OUTPUT);
  pinMode(21, OUTPUT);
  pinMode(22, OUTPUT);
  pinMode(25, OUTPUT);
  pinMode(26, OUTPUT);

  digitalWrite(18, LOW);
  digitalWrite(19, LOW);
  digitalWrite(21, LOW);
  digitalWrite(22, LOW);
  digitalWrite(25, LOW);
  noTone(26);

  Serial.println("Smart Distributed Water Pipeline Leak Detection System");
  Serial.println("Commands: N = NORMAL, B = LEAK B-C, C = LEAK C-D, T = TRANSIENT");
  currentScenario = SCENARIO_NORMAL;
}

void loop() {
  handleSerialCommand();
  readSensors();
  calculateStatistics();
  detectAnomaly();
  filterTransient();
  printStatus();
  delay(2000);
}
