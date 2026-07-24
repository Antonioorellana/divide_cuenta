# Prompt maestro: construir “La Justa”

## Propósito de este documento

Este prompt reúne el problema original, las decisiones de producto, las reglas de negocio, el flujo de usuario, los cálculos y los límites técnicos acordados para construir **La Justa**.

Está escrito para entregárselo a otra persona o a un agente de desarrollo sin necesidad de compartirle la conversación original.

---

# Prompt

Actúa como un ingeniero de software senior full-stack y diseñador de producto. Construye un MVP funcional, móvil y accesible llamado **La Justa**, destinado a dividir de forma rápida y transparente una cuenta detallada de un pub, bar o restaurante entre un grupo de amigos.

No conviertas el proyecto en una plataforma financiera, una red social ni un sistema de pagos. Su finalidad es realizar un cálculo posterior al pago: una persona adelanta el total de la cuenta y los demás asistentes le transfieren posteriormente lo que les corresponde.

## 1. Problema que debe resolver

Cuando un grupo sale a un pub o restaurante, normalmente una sola persona paga la cuenta completa. Después, el grupo debe calcular cuánto tiene que devolverle cada asistente según:

- Los productos que consumió.
- Las cantidades que consumió.
- Los productos compartidos con otras personas.
- La parte proporcional de la propina.

Hacer este cálculo manualmente es lento, propenso a errores y suele ocurrir cuando el grupo quiere retirarse rápidamente.

La aplicación debe transformar la cuenta detallada en un resumen individual claro y compartible.

La propuesta de valor es:

> Fotografiar, distribuir y compartir una cuenta grupal en menos de 60 segundos.

## 2. Contexto chileno

La aplicación estará inicialmente orientada a Chile:

- Utiliza pesos chilenos (`CLP`).
- Los montos normalmente se expresan sin decimales.
- La propina habitual sugerida es del 10%, pero es voluntaria.
- Deben existir opciones para 0%, 10%, 15% y un porcentaje personalizado.
- La propina debe distribuirse proporcionalmente al subtotal de consumo asignado a cada persona.

No presentes la propina como obligatoria.

## 3. Documento de entrada

El documento útil no es necesariamente la boleta tributaria final, porque esta puede contener solamente el total pagado.

La aplicación necesita fotografiar la **cuenta detallada**, también denominada según el establecimiento:

- Precuenta.
- Preboleta.
- Cuenta de consumo.
- Comanda impresa.

Esta cuenta debe contener, al menos:

- Nombre o descripción del producto.
- Cantidad.
- Precio unitario o total de la línea.
- Subtotal.
- Propina sugerida, si aparece.
- Total sugerido, si aparece.

En la interfaz utiliza el término comprensible **“cuenta detallada”**, evitando depender de una denominación comercial o tributaria específica.

## 4. Principio de funcionamiento

El flujo completo debe ser:

```text
Fotografiar cuenta detallada
→ reconocer o ingresar productos
→ revisar y corregir productos, cantidades y precios
→ agregar asistentes mediante alias
→ seleccionar quién pagó la cuenta
→ asignar consumos individuales
→ marcar los consumos compartidos
→ confirmar la propina realmente pagada
→ calcular las devoluciones
→ revisar el resumen
→ compartir resumen y fotografía original
→ finalizar y eliminar la sesión
```

## 5. Naturaleza efímera de la aplicación

La aplicación no requiere identidad permanente.

No debe solicitar ni almacenar:

- RUT.
- Correo electrónico.
- Número telefónico.
- Nombre legal.
- Contactos del teléfono.
- Datos bancarios.
- Tarjetas.
- Historial permanente de cuentas.
- Perfiles de usuario.
- Relaciones de amistad.

Los participantes se identifican solamente mediante alias temporales, por ejemplo:

- Pedro.
- Ana.
- Luis.
- Carla.

La información pertenece a una sesión temporal. Después de compartir el resultado y confirmar la finalización, deben eliminarse:

- Imagen de la cuenta.
- Alias de participantes.
- Pagador.
- Productos.
- Asignaciones.
- Propina.
- Resultados.

Si se implementa recuperación ante cierre accidental, utiliza exclusivamente almacenamiento local temporal con vencimiento corto. No agregues una base de datos ni un backend solamente para conservar una sesión.

## 6. Participantes y pagador

El usuario debe poder:

- Agregar participantes mediante alias.
- Ver claramente la cantidad de asistentes.
- Seleccionar a una persona como pagador.
- Cambiar el pagador antes de finalizar.

El pagador también puede haber consumido.

El pagador no se transfiere dinero a sí mismo. Su monto aparece como **“Parte propia”**.

Para los demás participantes, el resultado debe aparecer como **“Transfiere”**.

Ejemplo:

```text
Total pagado por Pedro: $55.000

Ana transfiere:   $16.500
Luis transfiere:  $11.000
Carla transfiere:  $5.500
Parte de Pedro:   $22.000
```

La suma debe satisfacer:

```text
transferencias recibidas por el pagador + parte propia del pagador
= total pagado
```

## 7. Representación de productos

Mantén una sola fila o tarjeta por línea de la cuenta.

No descompongas visualmente una línea como:

```text
Cerveza 1/4
Cerveza 2/4
Cerveza 3/4
Cerveza 4/4
```

En su lugar, muestra:

```text
4 × Cerveza artesanal — $16.000
```

Cada participante debe tener una casilla interactiva dentro de esa fila.

Como una casilla booleana no puede expresar que una persona consumió varias unidades, cada casilla debe funcionar como **contador**:

- Primer toque: asigna una unidad.
- Toques posteriores: incrementan unidades.
- Debe existir una forma evidente de disminuir la cantidad.
- La suma de cantidades asignadas nunca puede superar la cantidad de la cuenta.
- La interfaz debe indicar cuántas unidades quedan pendientes.

Ejemplo:

```text
4 × Cerveza — $16.000

Pedro [3]   Ana [1]   Luis [—]   Carla [—]

Asignadas: 4/4
```

El cálculo sería:

```text
Precio unitario: $16.000 / 4 = $4.000
Pedro: 3 × $4.000 = $12.000
Ana:   1 × $4.000 =  $4.000
```

## 8. Consumos compartidos

Cada producto debe incluir un control explícito:

```text
[ ] Compartir este consumo
```

Al activar **Compartir**:

- Se abandona el reparto por unidades para esa línea.
- Las casillas de participantes pasan a ser selecciones simples.
- Deben seleccionarse al menos dos personas.
- El valor completo de la línea se divide en partes iguales entre las personas seleccionadas.
- La interfaz debe explicar que se divide el monto, no la cantidad.

Ejemplo:

```text
1 × Tabla para compartir — $15.000

[✓] Compartir este consumo

Pedro [✓]   Ana [✓]   Luis [✓]   Carla [✓]

$15.000 / 4 = $3.750 por persona
```

Los modos son mutuamente excluyentes:

- Asignación por cantidades.
- División compartida del valor.

No permitas usar ambos modos simultáneamente para la misma línea, porque produciría una asignación ambigua.

## 9. Validaciones

La aplicación no debe permitir finalizar mientras exista una asignación incompleta o inconsistente.

Debe validar:

1. Cada producto no compartido tiene exactamente todas sus unidades asignadas.
2. Ningún producto supera la cantidad indicada en la cuenta.
3. Cada producto compartido tiene al menos dos participantes.
4. La suma de las líneas coincide con el subtotal.
5. La suma de subtotales personales coincide con el subtotal de la cuenta.
6. La suma de las propinas personales coincide exactamente con la propina total.
7. La suma de los totales personales coincide exactamente con el total pagado.

Muestra siempre un indicador como:

```text
Unidades asignadas: 8/9
Consumo asignado: $55.000
Pendiente: $5.000
```

Cuando todo esté correcto:

```text
Total distribuido: $66.000 ✓
La suma coincide con el total pagado.
```

## 10. Propina proporcional

Primero calcula el subtotal de consumo de cada persona.

Después distribuye la propina proporcionalmente:

```text
proporción_persona = subtotal_persona / subtotal_cuenta
propina_persona = propina_total × proporción_persona
total_persona = subtotal_persona + propina_persona
```

Si el valor real de la propina aparece o es confirmado por el usuario, utiliza ese monto como fuente de verdad. No vuelvas a imponer automáticamente un 10%.

Una persona con subtotal cero debe pagar cero propina.

## 11. Redondeo monetario

No uses números decimales en el resultado final en pesos chilenos.

Usa un algoritmo determinista de **restos mayores**:

1. Calcula la distribución exacta.
2. Asigna inicialmente la parte entera inferior.
3. Calcula cuántos pesos faltan para alcanzar el total.
4. Entrega los pesos restantes a los participantes con los residuos decimales más altos.
5. Usa un criterio estable de desempate.

Ejemplo:

```text
$10.000 compartidos entre 3 personas:

Persona A: $3.334
Persona B: $3.333
Persona C: $3.333

Total: $10.000
```

Nunca redondees cada monto de forma aislada sin reconciliar el total.

## 12. Resumen final

El resumen debe mostrar:

- Pagador.
- Total pagado.
- Subtotal de consumo.
- Porcentaje y monto de propina.
- Subtotal individual.
- Propina individual.
- Total individual.
- “Transfiere” para cada persona distinta del pagador.
- “Parte propia” para el pagador.
- Confirmación de que el total está completamente distribuido.

Ejemplo:

```text
Cuenta del grupo 🍻

Total pagado por Pedro: $66.000
Consumo: $60.000
Propina (10%): $6.000

Transferencias:
• Ana: $16.500
• Luis: $11.000
• Carla: $5.500

Parte de Pedro: $33.000
Total distribuido: $66.000 ✅
```

## 13. Compartir

La acción principal debe ser:

```text
Compartir cuenta y resumen
```

Debe abrir el menú nativo de compartir del dispositivo con:

- Texto del resumen.
- Fotografía original de la cuenta detallada.

WhatsApp será un destino habitual, pero no acoples toda la implementación exclusivamente a WhatsApp.

Implementa:

- Menú nativo de compartir cuando el dispositivo lo soporte.
- Verificación de soporte para compartir archivos.
- Alternativa para copiar el texto cuando no se pueda adjuntar la imagen.
- Manejo de cancelación sin perder la sesión.

La aplicación no puede asumir que abrir WhatsApp significa que el mensaje fue enviado.

Después de volver del menú de compartir, permite:

```text
Finalizar y eliminar sesión
```

No borres automáticamente la información apenas se abre el menú, porque el usuario podría cancelar, elegir un destinatario incorrecto o encontrar un error.

## 14. Fotografía de la cuenta

La fotografía debe mantenerse tal como fue capturada y adjuntarse como respaldo del cálculo.

No apliques transformaciones innecesarias al documento.

Durante el MVP:

- La imagen puede mantenerse en memoria o almacenamiento local temporal.
- Debe mostrarse una vista previa.
- Debe existir la opción de reemplazarla.
- Debe eliminarse al finalizar la sesión.

## 15. OCR

Diseña la arquitectura para integrar OCR posteriormente, pero no simules que una imagen fue reconocida si todavía no existe un motor real.

El reconocimiento deberá extraer:

- Descripción.
- Cantidad.
- Precio unitario, cuando exista.
- Total de línea.
- Subtotal.
- Propina sugerida.
- Total sugerido.

Como las cuentas pueden estar arrugadas, borrosas o usar abreviaturas, el OCR nunca debe ser tratado como fuente infalible.

Después de reconocer una imagen, debe existir una pantalla de revisión para:

- Corregir nombres.
- Corregir cantidades.
- Corregir precios.
- Agregar líneas omitidas.
- Eliminar líneas incorrectas.
- Confirmar que la suma coincide con el subtotal impreso.

Si todavía no se implementa OCR, utiliza datos demostrativos claramente identificados como ejemplo y permite la carga de la fotografía solamente como adjunto.

## 16. Diseño y experiencia

Construye una interfaz:

- Mobile-first.
- Rápida.
- Táctil.
- Accesible.
- Sin navegación administrativa.
- Sin dashboard genérico.
- Sin formularios extensos.

La primera vista debe enfocarse inmediatamente en la cuenta activa.

Estructura visual recomendada:

1. Encabezado con nombre del producto y estado de sesión temporal.
2. Fotografía o botón para adjuntar la cuenta.
3. Participantes y pagador.
4. Detalle de consumos.
5. Propina.
6. Total y validaciones.
7. Resumen en panel inferior.
8. Compartir y eliminar.

Cada tarjeta de producto debe mostrar:

- Cantidad.
- Nombre.
- Precio unitario calculado.
- Total de línea.
- Participantes.
- Contador o selección por persona.
- Opción “Compartir este consumo”.
- Estado “Pendiente” o “Completo”.

La experiencia debe funcionar con desplazamiento horizontal de participantes cuando el grupo sea grande, sin romper la pantalla móvil.

No dependas solamente del color para comunicar estados. Acompaña los colores con textos como:

- Pendiente.
- Completo.
- Compartido.
- Error.

## 17. Estilo visual

Utiliza una estética cálida, informal y confiable, adecuada para una salida entre amigos:

- Fondo marfil o papel.
- Verde oscuro como color principal.
- Acentos ámbar o terracota.
- Tarjetas claras.
- Bordes suaves.
- Sombras discretas.
- Tipografía legible.
- Controles táctiles grandes.

Evita:

- Estética bancaria.
- Exceso de gráficos.
- Interfaces empresariales.
- Decoraciones que retrasen el flujo.
- Iconografía confusa.

Nombre del producto:

```text
La Justa
```

Propuesta de frase:

```text
Divide. Comparte. Listo.
```

## 18. Stack técnico recomendado

Implementa el MVP con:

- React moderno.
- TypeScript estricto.
- Componentes funcionales.
- Estado local.
- CSS responsivo.
- Formato monetario `es-CL` y moneda `CLP`.
- Web Share API con detección de capacidades.

No agregues backend ni base de datos durante esta etapa.

Mantén la lógica monetaria separada de la interfaz para poder probar:

- Distribución proporcional.
- División compartida.
- Redondeo.
- Propina.
- Reconciliación del total.

Usa nombres semánticos y documentación JSDoc para las funciones de cálculo no obvias.

## 19. Modelo de datos mínimo

```ts
type Participant = {
  id: string;
  name: string;
};

type BillItem = {
  id: string;
  name: string;
  quantity: number;
  total: number;
  shared: boolean;
  assignments: Record<string, number>;
};
```

Interpretación de `assignments`:

- En modo normal, el valor representa la cantidad consumida.
- En modo compartido, un valor positivo representa que la persona participa en la división equitativa.

Para una versión posterior, considera modelar ambos tipos mediante una unión discriminada para evitar estados inválidos.

## 20. Datos demostrativos

Incluye inicialmente un caso que permita probar cantidades, productos compartidos y consumos pendientes:

```ts
const participants = [
  { id: "pedro", name: "Pedro" },
  { id: "ana", name: "Ana" },
  { id: "luis", name: "Luis" },
  { id: "carla", name: "Carla" },
];

const items = [
  {
    id: "cerveza",
    name: "Cerveza artesanal",
    quantity: 4,
    total: 16000,
    shared: false,
    assignments: { pedro: 2, ana: 1, luis: 1 },
  },
  {
    id: "hamburguesa",
    name: "Hamburguesa de la casa",
    quantity: 2,
    total: 24000,
    shared: false,
    assignments: { pedro: 1, carla: 1 },
  },
  {
    id: "tabla",
    name: "Tabla para compartir",
    quantity: 1,
    total: 15000,
    shared: true,
    assignments: { pedro: 1, ana: 1, luis: 1, carla: 1 },
  },
  {
    id: "agua",
    name: "Agua mineral",
    quantity: 2,
    total: 5000,
    shared: false,
    assignments: { ana: 1 },
  },
];
```

Deja una unidad pendiente para demostrar que el sistema bloquea el resumen mientras la cuenta no esté completamente distribuida.

## 21. Criterios de aceptación

El MVP se considera correcto cuando:

1. Se puede adjuntar una fotografía de la cuenta.
2. Se pueden agregar participantes mediante alias.
3. Se puede seleccionar al pagador.
4. Un mismo producto con cantidad mayor que uno puede distribuirse entre varias personas sin duplicar filas.
5. Una persona puede recibir varias unidades del mismo producto.
6. Un producto puede marcarse como compartido.
7. Los productos compartidos se dividen entre las personas seleccionadas.
8. No se puede asignar una cantidad superior a la disponible.
9. No se puede finalizar con unidades pendientes.
10. La propina se reparte proporcionalmente al consumo.
11. Todos los redondeos preservan exactamente el total.
12. El pagador aparece con “Parte propia”.
13. Los demás aparecen con “Transfiere”.
14. El resumen puede compartirse con la imagen original.
15. Cancelar el menú de compartir no borra la sesión.
16. Finalizar elimina toda la información temporal.
17. La interfaz funciona correctamente en pantalla móvil.
18. No se solicitan datos personales innecesarios.

## 22. Pruebas mínimas

Implementa pruebas para:

- Un producto asignado completamente a una persona.
- Varias unidades distribuidas entre varias personas.
- Una persona con varias unidades del mismo producto.
- Producto compartido entre dos personas.
- Producto compartido entre tres personas con monto no divisible exactamente.
- Propina de 0%.
- Propina de 10%.
- Propina personalizada.
- Participante con consumo cero.
- Redondeo con restos iguales.
- Suma final exacta.
- Bloqueo por unidades pendientes.
- Cambio de modo normal a compartido.
- Cancelación del envío.
- Eliminación de la sesión.

## 23. Prioridades de implementación

Trabaja en este orden:

1. Motor de distribución y redondeo.
2. Participantes y pagador.
3. Asignación por cantidades.
4. Modo compartido.
5. Validaciones.
6. Propina proporcional.
7. Resumen.
8. Compartir texto e imagen.
9. Eliminación de sesión.
10. Carga y vista previa de imagen.
11. OCR real.

No comiences por OCR. La aplicación debe calcular correctamente aunque los productos se ingresen manualmente. Automatizar una lógica incorrecta solamente produce errores más rápido.

## 24. Fuera del alcance inicial

No implementes todavía:

- Registro de usuarios.
- Inicio de sesión.
- Historial en la nube.
- Sincronización entre dispositivos.
- Integración bancaria.
- Transferencias automáticas.
- Lectura de contactos.
- Seguimiento de pagos.
- Notificaciones.
- Perfiles sociales.
- Geolocalización.
- Integración con restaurantes.
- Entrenamiento de modelos con las fotografías.

Estas características aumentan la complejidad y el tratamiento de datos sin ser necesarias para validar el problema principal.

## 25. Entrega esperada

Entrega:

- Aplicación funcional y responsiva.
- Código TypeScript limpio.
- Lógica monetaria testeada.
- Instrucciones breves para ejecutar.
- Descripción explícita de lo implementado.
- Lista honesta de las partes pendientes.

No presentes una demostración visual como si fuera un producto terminado. Si el OCR todavía no está conectado, indícalo claramente.

El objetivo del primer prototipo es comprobar:

> ¿Puede un grupo distribuir correctamente una cuenta real y obtener los montos de transferencia en menos de 60 segundos?

---

## Decisiones que llevaron a este resultado

La solución evolucionó mediante las siguientes decisiones:

1. **Se descartó dividir la cuenta solamente en partes iguales.** El problema principal era respetar el consumo real de cada persona.
2. **Se estableció que una sola persona paga inicialmente.** La aplicación calcula devoluciones posteriores; no procesa el pago del restaurante.
3. **Se distinguió la boleta final de la cuenta detallada.** Para asignar productos se necesita la precuenta o comanda con descripciones, cantidades y precios.
4. **Se descartó separar visualmente cada unidad en filas `1/2`, `2/2`.** Se mantuvo una fila compacta y se introdujeron contadores por participante.
5. **Se detectó que una casilla booleana era insuficiente.** Una persona puede haber consumido varias unidades del mismo producto.
6. **Se agregó un modo compartido explícito.** Una línea puede dividirse por valor entre varias personas.
7. **Se definió la propina como proporcional.** Cada persona aporta según su subtotal de consumo.
8. **Se incorporó reconciliación de redondeos.** Ningún peso puede quedar sin asignar o asignarse dos veces.
9. **Se definió una sesión efímera.** No existen cuentas, nombres legales ni historial permanente.
10. **Se mantuvo la fotografía original como respaldo.** El resumen debe compartirse junto con la cuenta detallada.
11. **Se evitó borrar al abrir WhatsApp.** La aplicación no puede confirmar que el mensaje fue enviado; debe esperar confirmación del usuario.
12. **Se postergó el OCR respecto del motor de cálculo.** Primero debe funcionar correctamente la distribución manual.

Estas decisiones mantienen el producto enfocado en rapidez, claridad y exactitud.
