# Spec Delta

## Purpose

Permite que un visitante del sitio sepa si Bigway llega a su dirección, mostrando su ubicación y solo la cobertura inmediata alrededor, sin exponer el mapa completo de la red.

## ADDED Requirements

### Requirement: Mapa inicial sin zonas de cobertura
Antes de que el visitante busque una dirección, la sección de cobertura SHALL mostrar el mapa base encuadrado en el Gran Mendoza, sin ninguna zona de cobertura dibujada.

#### Scenario: Visitante llega a la sección sin buscar
- **WHEN** el visitante hace scroll hasta la sección de cobertura y el mapa termina de cargar
- **THEN** el mapa se ve encuadrado en el Gran Mendoza
- **AND** no se dibuja ninguna zona de fibra ni de wireless

### Requirement: El mapa completo de cobertura no se envía al navegador
El sitio MUST NOT enviar al navegador el conjunto completo de zonas de cobertura, ni en el HTML, ni en los assets estáticos, ni en las respuestas de la API. Las únicas geometrías de cobertura que salen del servidor SHALL ser las recortadas alrededor de un punto consultado.

#### Scenario: Inspección de la carga de la página
- **WHEN** se carga la página de inicio y la sección de cobertura sin buscar ninguna dirección
- **THEN** ninguna respuesta de red contiene geometrías de zonas de cobertura

#### Scenario: Inspección del build
- **WHEN** se genera el build de producción
- **THEN** ningún archivo servido como estático al cliente contiene las geometrías de las zonas de cobertura

### Requirement: Cobertura alrededor de la dirección buscada
Al resolverse una dirección, el mapa SHALL mostrar un pin en el punto y SHALL dibujar solo las partes de las zonas de cobertura que caen dentro de un radio de 500 m alrededor del punto, diferenciando fibra y wireless.

#### Scenario: Dirección dentro de una zona de fibra
- **WHEN** el visitante busca una dirección que cae dentro de una zona de fibra
- **THEN** el mapa muestra el pin en esa dirección y la cobertura de fibra dentro del radio de 500 m
- **AND** ninguna parte de zona se dibuja a más de 500 m del punto

#### Scenario: Zona más grande que el radio
- **WHEN** la dirección cae en una zona que se extiende más allá de los 500 m
- **THEN** la zona se dibuja recortada al borde del radio y no se ve el resto de su forma

#### Scenario: Nueva búsqueda
- **WHEN** el visitante busca una segunda dirección
- **THEN** el pin y la cobertura de la búsqueda anterior desaparecen y solo se ven los de la nueva dirección

### Requirement: Resultado de cobertura en la dirección
Al resolverse una dirección, la sección SHALL informar si el punto exacto tiene fibra, wireless o ninguna de las dos. Cuando hay ambas, prevalece fibra. El resultado se calcula contra el mapa completo de cobertura, no solo contra lo que se dibuja.

#### Scenario: Punto con fibra y wireless
- **WHEN** la dirección cae dentro de una zona de fibra y de una de wireless a la vez
- **THEN** el resultado informa que hay fibra óptica y ofrece ver los planes

#### Scenario: Punto solo con wireless
- **WHEN** la dirección cae solo dentro de una zona wireless
- **THEN** el resultado informa que llega Internet wireless y ofrece ver los planes

#### Scenario: Punto sin cobertura con zonas cercanas
- **WHEN** la dirección no cae en ninguna zona pero hay zonas a menos de 500 m
- **THEN** el resultado informa que todavía no llegan a esa dirección y ofrece contacto
- **AND** el mapa muestra las zonas cercanas recortadas al radio

#### Scenario: Punto sin cobertura ni zonas cercanas
- **WHEN** la dirección no cae en ninguna zona y no hay zonas a menos de 500 m
- **THEN** el resultado informa que todavía no llegan a esa dirección y ofrece contacto
- **AND** el mapa muestra solo el pin

### Requirement: Consulta de cobertura por coordenada
El servidor SHALL exponer una consulta pública que recibe la latitud y longitud de un punto y responde las tecnologías que cubren el punto y la cobertura recortada a 500 m como GeoJSON. Las coordenadas inválidas o fuera del área de servicio SHALL rechazarse con un error de cliente.

#### Scenario: Coordenada válida
- **WHEN** se consulta una coordenada válida dentro de la provincia de Mendoza
- **THEN** la respuesta indica las tecnologías del punto y las zonas recortadas al radio de 500 m

#### Scenario: Coordenada inválida
- **WHEN** se consulta con latitud o longitud ausente, no numérica o fuera de rango
- **THEN** la respuesta es un error de cliente y no contiene datos de cobertura

#### Scenario: Coordenada fuera del área de servicio
- **WHEN** se consulta un punto fuera de la provincia de Mendoza
- **THEN** la respuesta es un error de cliente y no contiene datos de cobertura

### Requirement: Límite de consultas por visitante
La consulta de cobertura SHALL limitar la cantidad de consultas por cliente en una ventana de tiempo, para que no se pueda reconstruir el mapa completo consultando una grilla de puntos. Al superar el límite, SHALL responder un error de demasiadas solicitudes sin datos de cobertura.

#### Scenario: Uso normal
- **WHEN** un visitante hace algunas búsquedas seguidas, como lo haría una persona
- **THEN** todas se responden normalmente

#### Scenario: Barrido automatizado
- **WHEN** un mismo cliente supera el límite de consultas dentro de la ventana
- **THEN** las consultas siguientes se rechazan con un error de demasiadas solicitudes hasta que pase la ventana
- **AND** el sitio muestra un mensaje pidiendo que pruebe de nuevo en unos minutos

### Requirement: Las direcciones consultadas no se guardan
El servidor MUST NOT persistir ni registrar en logs las coordenadas o direcciones consultadas. Las respuestas de la consulta MUST NOT quedar almacenadas en caches compartidas.

#### Scenario: Consulta registrada en logs del servidor
- **WHEN** se procesa una consulta de cobertura, con éxito o con error
- **THEN** los logs del servidor no contienen la latitud ni la longitud consultadas

#### Scenario: Cache de la respuesta
- **WHEN** el servidor responde una consulta de cobertura
- **THEN** la respuesta indica que no debe almacenarse en caches compartidas

### Requirement: Fallo de la consulta de cobertura
Si la consulta de cobertura no responde o falla, la sección SHALL informar al visitante que no se pudo verificar la dirección y SHALL mantener el buscador usable para reintentar.

#### Scenario: Servidor no disponible
- **WHEN** el visitante busca una dirección y la consulta de cobertura falla o expira
- **THEN** la sección muestra un mensaje de que no se pudo verificar la dirección en este momento
- **AND** el visitante puede volver a buscar sin recargar la página
