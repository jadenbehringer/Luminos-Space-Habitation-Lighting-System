void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);
  float voltage = raw * (5.0 / 1023.0);
  float lux = map(raw, 0, 1023, 0, 1000);

  Serial.print("RAW:");
  Serial.print(raw);
  Serial.print(",VOLTAGE:");
  Serial.print(voltage, 2);
  Serial.print(",LUX:");
  Serial.println(lux);

  delay(100);
}