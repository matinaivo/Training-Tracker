V29 Bugfix:
- Duplizieren und Bearbeiten behalten angehakte Übungen jetzt bei.
- Ursache: show('add')/refresh() hatte die Checkboxen nach dem Setzen erneut gerendert.
- Hund-Auswahl wird zwischen Kalender, Heute, Balance und Eingabe synchronisiert.
- Kalenderfilter 'Alle Hunde' bleibt möglich; konkrete Hund-Auswahl wird global übernommen.
- Cache-Busting: app.js/styles.css ?v=29.
