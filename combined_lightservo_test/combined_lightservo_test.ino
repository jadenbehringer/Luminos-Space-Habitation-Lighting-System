#include <Servo.h>

Servo myServo;
const int SERVO_PIN = 9;
const int LIGHT_PIN = A0;
bool isAttached = false;
int currentMicroseconds = 1500;

unsigned long lastSensorRead = 0;
const int SENSOR_INTERVAL = 100; // ms between sensor readings

// GL5528-style power-law model:
//   Lux = 10 * (R10 / RLDR)^(1/gamma)
// with gamma = 0.7 and R10 = 7200 ohms.
const float VCC = 5.0;
const float R_FIXED = 10000.0;  // known resistor in divider (ohms)
const float GAMMA = 0.7;
const float R10 = 20000.0;       // LDR resistance at 10 lux (ohms)
const float ADC_AT_10_LUX_EXPECTED = 1023.0 / (R10 / R_FIXED + 1.0);

float rawToLuxPowerLaw(int raw) {
  if (raw <= 0) return 0.0;
  if (raw >= 1023) raw = 1022; // avoid divide-by-zero in RLDR computation

  float vOut = raw * (VCC / 1023.0);
  float rLdr = R_FIXED * ((VCC / vOut) - 1.0);
  if (rLdr <= 0.0) return 0.0;

  return 10.0 * pow(R10 / rLdr, 1.0 / GAMMA);
}

void setup() {
  Serial.begin(9600);
  Serial.setTimeout(10);
  Serial.println("Servo + Light Sensor Ready");
  Serial.println("Commands:");
  Serial.println("  0-180    -> move by angle");
  Serial.println("  + or ++  -> nudge +10us or +50us");
  Serial.println("  - or --  -> nudge -10us or -50us");
  Serial.println("  detach   -> stop buzzing");
  Serial.println("  status   -> print current us");
  Serial.print("Cal hint: with R10=");
  Serial.print(R10, 0);
  Serial.print(" ohm, ADC at 10 lux should be near ");
  Serial.println(ADC_AT_10_LUX_EXPECTED, 1);
}

void moveToMicroseconds(int us) {
  us = constrain(us, 725, 2310);
  currentMicroseconds = us;

  if (!isAttached) {
    myServo.attach(SERVO_PIN);
    isAttached = true;
  }

  myServo.writeMicroseconds(us);
  Serial.print("Position: ");
  Serial.print(us);
  Serial.println("us");
}

void readLightSensor() {
  int raw = analogRead(LIGHT_PIN);
  float voltage = raw * (5.0 / 1023.0);
  float lux = rawToLuxPowerLaw(raw);

  Serial.print("RAW:");
  Serial.print(raw);
  Serial.print(",VOLTAGE:");
  Serial.print(voltage, 2);
  Serial.print(",LUX:");
  Serial.println(lux, 1);
}

void loop() {
  // Non-blocking sensor read every 100ms
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = millis();
    readLightSensor();
  }

  // Serial command handling
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.equalsIgnoreCase("detach")) {
      myServo.detach();
      isAttached = false;
      Serial.println("Servo detached.");

    } else if (input.equalsIgnoreCase("status")) {
      Serial.print("Current: ");
      Serial.print(currentMicroseconds);
      Serial.println("µs");

    } else if (input == "+") {
      moveToMicroseconds(currentMicroseconds + 10);

    } else if (input == "++") {
      moveToMicroseconds(currentMicroseconds + 50);

    } else if (input == "-") {
      moveToMicroseconds(currentMicroseconds - 10);

    } else if (input == "--") {
      moveToMicroseconds(currentMicroseconds - 50);

    } else if (input.length() > 0 && (isDigit(input[0]) || input[0] == '-')) {
      int angle = input.toInt();
      if (angle >= 0 && angle <= 180) {
        int us = map(angle, 0, 180, 740, 2290);
        moveToMicroseconds(us);
      } else {
        Serial.println("Out of range. Use 0-180 for angles, or +/- to nudge.");
      }

    } else {
      Serial.println("Unknown command.");
    }
  }
}