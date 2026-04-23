void setup() {
  Serial.begin(9600);
}

// Correct divider inversion for LDR-on-top, fixed-resistor-to-GND wiring:
// R10 = 10000 * (1023 / ADC10 - 1)
float rawToR10(int raw) {
  if (raw <= 0) return -1.0;
  return 10000.0 * ((1023.0 / (float)raw) - 1.0);
}

void loop() {
  int raw = analogRead(A0);
  float r10 = rawToR10(raw);

  Serial.print("RAW:");
  Serial.print(raw);
  Serial.print(",R10:");
  if (r10 < 0.0) {
    Serial.println("INF");
  } else {
    Serial.println(r10, 2);
  }

  delay(100);
}