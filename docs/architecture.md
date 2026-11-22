# Arquitectura de producción de La Justa

## Decisión principal

La Justa se construirá como una **Progressive Web App instalable** y se
empaquetará posteriormente para iOS y Android mediante **Capacitor**. Esta
estrategia conserva la interfaz React existente y permite incorporar cámara,
compartir y OCR nativos sin mantener tres aplicaciones independientes.

## Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Lenguaje | TypeScript 5.x | Contratos estrictos y una sola base de código |
| Interfaz | React 19 | UI funcional y ecosistema maduro |
| Framework web | Next.js 16 + Vinext | PWA, metadatos y despliegue compatible con Cloudflare |
| Aplicación móvil | Capacitor | Empaquetado iOS/Android sin reescribir la interfaz |
| Diseño | CSS responsivo + sistema Luminous Ivory | Control visual directo y accesibilidad |
| Motor financiero | TypeScript puro | Lógica portable, determinista y testeable |
| Estado | Estado local de React | La sesión es pequeña y efímera |
| Recuperación local | IndexedDB con vencimiento | Fase siguiente; evita perder una sesión accidentalmente |
| Base de datos remota | Ninguna | No existe una finalidad válida para almacenar cuentas |
| OCR PWA | Tesseract.js 7 + modelo español local | Reconocimiento en el navegador sin subir imágenes |
| OCR nativo futuro | Apple Vision / Google ML Kit | Mayor precisión tras empaquetar con Capacitor |
| Compartir | Web Share API / share sheet nativo | WhatsApp y otros destinos sin acoplamiento |
| Pruebas | Node Test Runner | Sin dependencia adicional para el dominio |

## Por qué no se utilizará una base de datos central

La aplicación no necesita cuentas, historial, perfiles ni sincronización. Una
base de datos remota agregaría riesgo de seguridad, costos operacionales y
tratamiento innecesario de datos sin mejorar el cálculo.

La sesión se mantiene en memoria. En una fase posterior podrá recuperarse desde
IndexedDB durante un máximo breve y se purgará al finalizar o vencer.

## Módulos

```text
domain/
├── models.ts       Tipos del negocio
├── billing.ts      Distribución, propina y reconciliación
└── receipt-parser.ts Interpretación conservadora del texto OCR

app/
├── CuentaApp.tsx   Flujo y presentación
├── receipt-ocr.ts  Preparación de imagen y reconocimiento local
└── PwaRegistration.tsx

public/
├── manifest.webmanifest
└── sw.js
```

El OCR no debe escribir directamente en el estado visual. Producirá un borrador
de cuenta que el usuario deberá revisar y confirmar antes de asignar consumos.

## Fases

1. Motor financiero y pruebas.
2. PWA instalable.
3. Sesión local con vencimiento y purga.
4. Captura y edición real de productos.
5. OCR web local con revisión obligatoria.
6. Pruebas en dispositivos iOS y Android.
7. OCR nativo mediante Capacitor.
8. Empaquetado y distribución de prueba.

## Restricciones no negociables

- Todos los montos se calculan como enteros en CLP.
- La suma individual debe coincidir exactamente con el total pagado.
- Ninguna fotografía sale del dispositivo durante el OCR.
- No se solicitan identificadores personales.
- Finalizar elimina fotografía, alias y asignaciones.
