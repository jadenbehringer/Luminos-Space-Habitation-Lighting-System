#include <Servo.h>

Servo myServo;
const int SERVO_PIN = 9;
bool isAttached = false;
int currentMicroseconds = 1500; // start at center

void setup() {
  Serial.begin(9600);
  Serial.println("Servo Control Ready");
  Serial.println("Commands:");
  Serial.println("  0-180    → move by angle");
  Serial.println("  + or ++  → nudge +10µs or +50µs");
  Serial.println("  - or --  → nudge -10µs or -50µs");
  Serial.println("  detach   → stop buzzing");
  Serial.println("  status   → print current µs");
}

void moveToMicroseconds(int us) {
  // Hard safety clamp — never go outside 500-2500
  us = constrain(us, 725, 2310);
  currentMicroseconds = us;

  if (!isAttached) {
    myServo.attach(SERVO_PIN);
    isAttached = true;
  }

  myServo.writeMicroseconds(us);
  Serial.print("Position: ");
  Serial.print(us);
  Serial.println("µs  ⚠ Stop if servo strains or stalls!");
}

void loop() {
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