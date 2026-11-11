"""Genera documentos Word para PC3 a partir de los módulos presentes.

No inventa capturas, participación individual ni videos de sustentación.
"""
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs_pc3"
OUT.mkdir(exist_ok=True)


def base(title, subtitle):
    d = Document()
    sec = d.sections[0]
    sec.top_margin = Inches(.68)
    sec.bottom_margin = Inches(.65)
    sec.left_margin = Inches(.88)
    sec.right_margin = Inches(.88)
    normal = d.styles['Normal']
    normal.font.name = 'Aptos'
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor(24, 35, 45)
    normal.paragraph_format.space_after = Pt(5)
    for style, size in [('Title', 19), ('Heading 1', 13), ('Heading 2', 11)]:
        st = d.styles[style]
        st.font.name = 'Aptos Display'
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = RGBColor(0, 0, 0)
        st.paragraph_format.space_before = Pt(9)
        st.paragraph_format.space_after = Pt(5)
    heading=d.add_paragraph(title, 'Title')
    ppr=heading._p.get_or_add_pPr()
    for borders in ppr.findall(qn('w:pBdr')):
        ppr.remove(borders)
    title_style_ppr=d.styles['Title']._element.get_or_add_pPr()
    for borders in title_style_ppr.findall(qn('w:pBdr')):
        title_style_ppr.remove(borders)
    d.add_paragraph(subtitle)
    d.add_paragraph('Universidad Nacional de Ingeniería  |  CC451 Interacción Humano Computador  |  Grupo 10  |  11 de noviembre de 2026')
    return d


def p(d, text):
    d.add_paragraph(text)


def bullet(d, text):
    paragraph=d.add_paragraph('•  '+text)
    paragraph.paragraph_format.left_indent=Inches(.2)
    paragraph.paragraph_format.first_line_indent=Inches(-.14)
    paragraph.paragraph_format.space_after=Pt(5)


def table(d, headers, rows):
    t = d.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    for i, head in enumerate(headers):
        t.rows[0].cells[i].text = head
    for values in rows:
        cells = t.add_row().cells
        for i, value in enumerate(values):
            cells[i].text = str(value)
    for row in t.rows:
        tr_pr=row._tr.get_or_add_trPr()
        tr_pr.append(OxmlElement('w:cantSplit'))
        for cell in row.cells:
            for par in cell.paragraphs:
                for run in par.runs:
                    run.font.size = Pt(8)
    for cell in t.rows[0].cells:
        for par in cell.paragraphs:
            for run in par.runs:
                run.bold = True
    d.add_paragraph()


report = base('Informe de avance del proyecto PC3', 'TriageVoz Rural  |  Aplicación multimodal de pretriaje en telemedicina')
report.add_heading('1 Objetivo y alcance', 1)
p(report, 'Este informe registra el avance técnico verificable del prototipo TriageVoz Rural con interfaces de voz, táctiles y textuales. Se parte de la PC2 y se integra la lógica conversacional de Lab11 en una única PWA local. La aplicación utiliza exclusivamente casos ficticios y no ofrece atención clínica real.')
report.add_heading('2 Requisitos de la práctica calificada', 1)
table(report, ['Requisito', 'Implementación actual', 'Evidencia técnica'], [
    ('Interfaz de voz', 'Entrevista de cuatro preguntas, transcripción y lectura por voz; quechua experimental.', 'public/vui.js, assistant.mjs, gemini-api.mjs'),
    ('LLM intercambiable', 'Groq o Gemini para consultas del asistente; borrador médico mediante servicio remoto.', 'public/index.html, assistant.mjs, server.mjs'),
    ('PWA', 'Interfaz responsiva, manifiesto y service worker.', 'public/manifest.webmanifest, public/sw.js'),
    ('Personalización continua', 'Idioma, contraste, texto, lectura y preferencias persistentes por identificador ficticio.', 'public/app.js, API /api/profiles'),
    ('Multiusuario', 'Bandeja común de casos, acuse, respuesta profesional y consulta por código.', 'API /api/rooms y /api/cases'),
    ('Diseño emocional', 'Confirmaciones, microinteracciones, ayuda de accesibilidad, tono y feedback.', 'public/styles.css, public/navigation.js'),
    ('Licencia y datos', 'Licencia MIT y casos de demostración sin datos reales.', 'LICENSE, data/casos-ficticios.json'),
])
report.add_heading('3 Historias de usuario y trazabilidad', 1)
table(report, ['Historia y criterio de aceptación', 'RF asociado', 'Módulo / prueba'], [
    ('HU01 Como paciente elijo idioma y accesibilidad; las opciones se aplican al flujo.', 'RF01 Configuración accesible', 'navigation.js, app.js; validar en navegador'),
    ('HU02 Como paciente describo por voz o tacto la región; la silueta permite corregir.', 'RF02 Entrada multimodal', 'vui.js, app.js; tests/assistant.test.mjs'),
    ('HU03 Como paciente confirmo el resumen y recibo un código persistente.', 'RF03 Registro de caso', 'assistant.mjs, server.mjs; tests/flujo-voz-medico.test.mjs'),
    ('HU04 Como paciente consulto la respuesta por código; sin respuesta veo estado pendiente.', 'RF04 Seguimiento', 'navigation.js, API /api/cases/by-code'),
    ('HU05 Como profesional consulto cada caso, reviso un borrador IA, edito y envía respuesta.', 'RF05 Intervención humana', 'server.mjs, app.js; tests/flujo-voz-medico.test.mjs'),
])
report.add_heading('4 Requisitos no funcionales', 1)
bullet(report, 'RNF01 Usabilidad: una pantalla inicial con acceso a paciente, personal de salud y seguimiento; navegación con regreso.')
bullet(report, 'RNF02 Accesibilidad: texto grande, contraste, lectura por voz y alternativa táctil o textual.')
bullet(report, 'RNF03 Portabilidad: ejecución local con Node.js en una laptop convencional, PWA en navegador moderno.')
bullet(report, 'RNF04 Seguridad demostrativa: claves API solo en el servidor, datos ficticios; sin autenticación médica ni privacidad clínica adecuada para producción.')
report.add_heading('5 Avance y evidencias', 1)
p(report, 'Los módulos funcionales documentados cubren las capacidades obligatorias exigidas por la PC3. Se ejecutaron 20 pruebas automatizadas sin fallas en el entorno de desarrollo; esto no equivale a validar el porcentaje de pantallas ni a demostrar micrófono, servicios externos o uso real en dispositivos. La afirmación de un prototipo al 70 % debe respaldarse con capturas y sustentación.')
table(report, ['Evidencia de pantalla a incluir', 'Estado'], [
    ('Inicio y elección de rol', 'Captura pendiente'),
    ('Preferencias e interfaz de voz con silueta marcada', 'Captura pendiente'),
    ('Confirmación y código SALA generado', 'Captura pendiente'),
    ('Consulta de caso pendiente o respondido', 'Captura pendiente'),
    ('Bandeja médica y borrador IA editado', 'Captura pendiente'),
    ('Ejecución de npm test y pruebas de voz', 'Captura pendiente'),
])
report.add_heading('6 Repositorio y presentación', 1)
p(report, 'La entrega debe incluir repositorio público o accesible para el docente con README, diagrama C4 actualizado, guía de instalación, código y datos simulados. Registrar aquí el enlace al repositorio PC3 después de publicarlo: [ENLACE PENDIENTE]. El video de sustentación debe mostrar la aplicación: hasta 3 minutos por estudiante y 9 minutos como máximo para un grupo de tres, según el enunciado.')
report.add_heading('7 Limitaciones y conclusión', 1)
p(report, 'La transcripción y la voz en quechua son experimentales; faltan pruebas con hablantes competentes. La interpretación clínica está restringida a borradores para revisión profesional y nunca se envía sin decisión humana. El código no sustituye autenticación, por lo que el prototipo no debe usarse con datos reales. La solución demuestra integración de interacción no convencional, colaboración asíncrona y continuidad de la PC2.')
report.save(OUT / '01-informe-avance-PC3.docx')

workflow = base('Flujo de trabajo y arquitectura PC3', 'TriageVoz Rural  |  Recorrido de paciente y personal de salud')
workflow.add_heading('1 Flujo del paciente', 1)
for step in [
    'Inicio: elegir Soy paciente, Personal de salud o Revisión de diagnóstico.',
    'Paciente: seleccionar español o quechua experimental; activar alto contraste, texto grande y lectura por voz.',
    'Modalidad: elegir Asistente de voz o Formulario táctil. Ambas rutas se mantienen en la misma aplicación.',
    'Entrevista: informar molestia, inicio, intensidad y datos adicionales; señalar o corregir la zona en la silueta.',
    'Confirmación: revisar el resumen y corregirlo si es necesario. En modo voz el caso NO se registra antes del sí explícito.',
    'Registro: crear el código SALA, guardar el caso y anunciarlo por pantalla y por voz cuando esté habilitada.',
    'Seguimiento: ingresar el código en Revisión de diagnóstico y ver En espera o la respuesta del profesional.',
]:
    workflow.add_paragraph(step, 'List Number')
workflow.add_heading('2 Flujo del personal de salud', 1)
for idx, step in enumerate([
    'Abrir Personal de salud y seleccionar un caso de la bandeja o introducir su código.',
    'Consultar síntomas, región, inicio, intensidad, resumen y estado de recepción.',
    'Confirmar recepción. Opcionalmente generar con IA un borrador de respuesta con personalidad graduable (sin diagnóstico) y confirmarlo antes de registrar.',
    'Verificar el contenido con juicio profesional; corregir o reemplazar el borrador en Respuesta profesional simulada.',
    'Enviar la respuesta. El paciente podrá leerla posteriormente usando su código.',
], 1):
    workflow.add_paragraph(f'{idx}. {step}')
workflow.add_heading('3 Arquitectura simplificada tipo C4', 1)
p(workflow, 'Nivel de contexto: Paciente y personal de salud utilizan TriageVoz Rural, que puede solicitar modelos remotos Groq o Gemini. Nivel de contenedor: un servidor Node.js sirve la PWA y expone rutas HTTP; el navegador gestiona vistas, micrófono y accesibilidad; archivos JSON locales conservan casos y perfiles. Nivel de componente: navigation.js decide pantallas; vui.js coordina voz y silueta; assistant.mjs procesa intents y turnos; server.mjs persiste casos y produce borradores para el médico; gemini-api.mjs gestiona la transcripción experimental de quechua.')
table(workflow, ['Componente', 'Responsabilidad', 'Comunicación'], [
    ('Navegador PWA', 'Interacción visual, voz y silueta', 'HTTP local con servidor Node'),
    ('API Node.js', 'Casos, perfiles, confirmación, consulta y respuesta', 'JSON local, servicios LLM'),
    ('Motor de entrevista', 'Cuatro campos, intents, confirmación', 'Estado de sesión en memoria'),
    ('Proveedores externos', 'Transcripción, generación y voz disponibles según API', 'HTTPS; nunca recibe archivo .env'),
])
workflow.add_heading('4 Consideraciones de prueba', 1)
bullet(workflow, 'Dos navegadores locales pueden actuar como paciente y personal de salud, con actualización periódica de bandeja.')
bullet(workflow, 'Desconectar el proveedor LLM no debe impedir usar entrada textual, el formulario y la consulta de casos.')
bullet(workflow, 'Los casos ficticios persisten en data/runtime.json. No subir .env ni datos personales a GitHub.')
bullet(workflow, 'Comprobar el flujo de quechua con audio real y hablantes nativos antes de considerarlo validado.')
workflow.save(OUT / '02-flujo-de-trabajo-PC3.docx')


def contribution(filename, person, code, content, validation):
    d = base('Aporte personal en la PC3', f'{person}  |  Código {code}  |  TriageVoz Rural')
    d.add_heading('Alcance de esta entrega', 1)
    p(d, 'Este documento corresponde a la práctica calificada 03 del curso CC451. Debe ser leído y validado por su autor antes de presentarse como declaración individual.')
    d.add_heading('Aporte y evidencia', 1)
    for point in content:
        bullet(d, point)
    d.add_heading('Evidencias para adjuntar', 1)
    p(d, validation)
    d.add_heading('Validación del autor', 1)
    p(d, 'Confirmación de tareas propias, enlaces a commits y captura de módulo: [PENDIENTE DE REVISIÓN PERSONAL].')
    d.save(OUT / filename)


contribution('mi-aporte-cesar-lopez-arteaga-PC3.docx', 'César Omar López Arteaga', '20215508C', [
    'Integración del flujo PC2 con el motor conversacional de Lab11 en una PWA y servidor únicos, conservando silueta corporal y alternativas táctiles.',
    'Desarrollo del registro del triaje por voz tras confirmación explícita y generación de código único para seguimiento posterior.',
    'Incorporación de la consulta por código, los estados de espera y respuesta profesional, y el borrador IA editable en la bandeja del personal de salud.',
    'Verificación automatizada del flujo de extremo a extremo con la suite npm test (20 pruebas aprobadas en el entorno de trabajo).',
], 'Archivos de referencia: assistant.mjs, server.mjs, public/navigation.js, public/vui.js, tests/flujo-voz-medico.test.mjs. Adjuntar capturas y commits propios antes de entregar.')

contribution('mi-aporte-jesus-santa-cruz-basilio-PC3.docx', 'Jesus Diego Santa Cruz Basilio', '20235005G', [
    'Antecedente documentado de PC2: personalización continua por ritmo de respuesta, gestión de correcciones y ayudas de accesibilidad en el frontend.',
    'Continuidad de los módulos de personalización en PC3: debe precisarse por el autor cuáles ajustó, verificó o presentó durante esta nueva práctica.',
    'Describir aquí intervenciones concretas y vincularlas con archivos, commits y una demostración personal de tres minutos: [POR COMPLETAR POR EL INTEGRANTE].',
], 'Referencia de la implementación anterior: documentación personal de PC2. No hay evidencia individual suficiente en los archivos actuales para atribuir cambios adicionales de PC3 sin revisión del autor.')

contribution('mi-aporte-bryan-pumayauli-evangelista-PC3.docx', 'Bryan José Pumayauli Evangelista', '20212209E', [
    'Describir el módulo o funcionalidad PC3 efectivamente desarrollada o verificada: [POR COMPLETAR POR EL INTEGRANTE].',
    'Indicar cambios en código y documentación, con ruta de archivo y enlace al commit correspondiente: [POR COMPLETAR].',
    'Detallar las pruebas y la parte de la demostración de tres minutos realizadas personalmente: [POR COMPLETAR].',
], 'Se conserva el nombre y código del integrante del Grupo 10; no se atribuyen aportes técnicos sin evidencia proporcionada.')

print('Generados cinco documentos Word en', OUT)
