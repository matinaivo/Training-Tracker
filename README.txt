V100:
- Basis: V99.
- Bugfix Heute: Revieren, Huerde, Schraegwand und Verbellen werden nicht mehr aus Heute herausgefiltert.
- Ursache war der alte clubSubs-Filter in renderToday().
- Aktive, nicht beherrschte Uebungen erscheinen jetzt vollstaendig in Heute, auch wenn sie frueher als clubSubs markiert waren.
- V99-Fix bleibt erhalten: keine Begrenzung mehr auf 6 Uebungen pro Kategorie.
- Cache-Busting: app.js/styles.css ?v=100.
