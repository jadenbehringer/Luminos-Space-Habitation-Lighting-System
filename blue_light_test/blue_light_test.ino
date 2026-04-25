#include <Wire.h>
#include <Adafruit_TCS34725.h>

#define LED_PIN 4  // connect LED pad on sensor to Arduino pin 4

Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_600MS, TCS34725_GAIN_16X);

void setup() {
  Serial.begin(9600);
  
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);  // turn off onboard LED
  
  if (tcs.begin()) {
    Serial.println("Sensor found!");
  } else {
    Serial.println("No sensor found... check wiring");
    while (1);
  }
}

void loop() {
  uint16_t r, g, b, c;
  tcs.getRawData(&r, &g, &b, &c);
  
  Serial.print("Blue: ");
  Serial.println(b);
  
  delay(1000);
}