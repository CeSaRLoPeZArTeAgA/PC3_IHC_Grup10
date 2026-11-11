// Presentación reproducible del Grupo 10. Ejecutar: npm install --no-save pptxgenjs && node scripts/generar_presentacion.cjs
const pptxgen=require('pptxgenjs');
const fs=require('fs');
const path=require('path');
const pptx=new pptxgen();
pptx.layout='LAYOUT_WIDE';
pptx.author='Grupo 10 - CC451 UNI';
pptx.subject='PC2 TriageVoz Rural: prototipo no clínico';
pptx.title='TriageVoz Rural - Sustentación PC2';
pptx.lang='es-PE';
pptx.company='Universidad Nacional de Ingeniería';
const W=13.333,H=7.5;
const C={navy:'163B50',blue:'08738A',ice:'EAF5F8',line:'BAD5DD',white:'FFFFFF',gray:'456477',gold:'D79B43',red:'B34E4E'};
const SH=pptx.ShapeType;
function text(sl,t,x,y,w,h,opts={}){
 sl.addText(t,{x,y,w,h,fontFace:'Aptos',fontSize:18,color:C.navy,margin:0.04,breakLine:false,valign:'mid',...opts});
}
function box(sl,x,y,w,h,fill=C.ice,line=C.line,r=0.16){
 sl.addShape(SH.roundRect,{x,y,w,h,rectRadius:r,line:{color:line,width:1},fill:{color:fill},radius:r});
}
function base(title,num){
 const sl=pptx.addSlide();sl.background={color:C.white};
 sl.addShape(SH.rect,{x:0,y:0,w:0.16,h:H,line:{color:C.blue},fill:{color:C.blue}});
 text(sl,title,0.65,0.42,12.15,0.78,{fontSize:29,bold:true,color:C.navy});
 sl.addShape(SH.line,{x:0.65,y:1.37,w:11.95,h:0,line:{color:C.line,width:1.1}});
 text(sl,'TriageVoz Rural · PC2 · Grupo 10 · UNI',0.65,7.10,11.65,0.24,{fontSize:10,color:C.gray});
 text(sl,String(num).padStart(2,'0'),12.33,7.07,0.35,0.25,{fontSize:10,bold:true,color:C.blue,align:'right'});
 return sl;
}
function bullet(sl,t,x,y,w,opts={}){text(sl,'• '+t,x,y,w,0.57,{fontSize:17,color:C.navy,...opts});}
let s=base('TriageVoz Rural',1);
text(s,'Pre-triaje multimodal en postas rurales',0.7,1.70,12,0.70,{fontSize:27,bold:true,color:C.blue});
box(s,0.70,2.67,11.88,2.62,C.ice,C.line);
text(s,'Grupo 10  ·  CC451 Interacción Humano-Computador',1.05,2.95,11.20,0.44,{fontSize:20,bold:true});
text(s,'Santa Cruz Basilio, Jesus Diego — 20235005G\nLópez Arteaga, César Omar — 20236743A\nPumayauli Evangelista, Bryan José — 20212209E',1.05,3.53,10.8,1.4,{fontSize:19,breakLine:false});
text(s,'Prototipo educativo con casos ficticios; no valida ni sustituye una valoración médica.',0.74,5.70,11.9,0.58,{fontSize:16,color:C.red});

s=base('01 · Problema y propósito',2);
bullet(s,'Limitaciones de especialistas y conectividad en postas rurales.',0.85,1.85,11.5);
bullet(s,'Registro inicial de síntomas con voz, texto y silueta corporal.',0.85,2.75,11.5);
bullet(s,'Confirmación y corrección de datos antes de compartir el caso.',0.85,3.65,11.5);
box(s,0.83,4.68,11.65,1.33);
text(s,'Alcance: organizar un relato ficticio y facilitar su revisión por un rol médico simulado; sin clasificación clínica automatizada.',1.12,4.92,10.96,0.89,{fontSize:19,bold:true});

s=base('02 · PACT y diversidad de usuarios',3);
const pact=[['Personas','Pacientes, adultos mayores, discapacidad, personal de posta y médicos.'],['Actividades','Seleccionar región, responder, confirmar, enviar y consultar respuesta.'],['Contextos','Conectividad inestable, estrés, equipos compartidos y entornos ruidosos.'],['Tecnologías','PWA, SVG táctil, Web Speech API opcional, servidor Node.js y JSON.']];
pact.forEach((p,i)=>{const y=1.71+i*1.17;box(s,0.8,y,2.4,0.92,C.blue,C.blue);text(s,p[0],1.05,y+0.16,1.90,0.55,{color:C.white,bold:true,fontSize:18});box(s,3.4,y,9.1,0.92);text(s,p[1],3.68,y+0.11,8.5,0.70,{fontSize:16});});

s=base('03 · Arquitectura C4 / contenedores',4);
const cards=[{x:0.75,w:3.38,a:'Navegador PWA',b:'Interfaz, accesibilidad, voz y silueta'},{x:5.00,w:3.35,a:'Servidor Node.js',b:'API REST, validación y envío de casos'},{x:9.18,w:3.33,a:'JSON local',b:'Persistencia de casos ficticios'}];
cards.forEach(z=>{box(s,z.x,2.12,z.w,1.72);text(s,z.a,z.x+0.18,2.42,z.w-0.36,0.49,{fontSize:20,bold:true,color:C.blue,align:'center'});text(s,z.b,z.x+0.15,3.03,z.w-0.30,0.67,{fontSize:14,align:'center'})});
text(s,'→',4.31,2.66,0.53,0.6,{fontSize:31,bold:true,color:C.blue});
text(s,'→',8.50,2.66,0.53,0.6,{fontSize:31,bold:true,color:C.blue});
box(s,4.74,4.54,3.78,1.2,C.ice,C.gold);
text(s,'Gemini opcional',5.06,4.72,3.13,0.40,{fontSize:18,bold:true,align:'center'});
text(s,'Clave solo en servidor · fallback local',5.02,5.12,3.20,0.34,{fontSize:12,align:'center'});

s=base('04 · Flujo principal de interacción',5);
const stages=[['1','Preferencias e inicio'],['2','Zona corporal y confirmación'],['3','Entrevista: cuatro preguntas'],['4','Resumen y envío'],['5','Recepción y respuesta']];
stages.forEach((z,i)=>{const y=1.62+i*0.92;box(s,0.93,y,11.42,0.73,i%2===0?C.ice:C.white);box(s,1.04,y+0.13,0.47,0.45,C.blue,C.blue);text(s,z[0],1.17,y+0.17,0.18,0.28,{fontSize:13,color:C.white,bold:true,align:'center'});text(s,z[1],1.79,y+0.12,9.95,0.45,{fontSize:19});});
text(s,'El último código demo puede recuperarse tras recargar el navegador.',0.93,6.45,11.40,0.37,{fontSize:15,color:C.gray});

s=base('05 · Tres propuestas de interfaz',6);
[['A · Formulario','Secuencial y claro; requiere lectura.'],['B · Conversación','Menor escritura; vulnerable a ruido y permisos.'],['C · Multimodal','Silueta + voz + texto + confirmación.']].forEach((p,i)=>{const x=0.81+i*4.18;box(s,x,2.0,3.89,3.17,i===2?'D8F1F3':C.ice,i===2?C.blue:C.line);text(s,p[0],x+0.24,2.33,3.44,0.65,{fontSize:23,color:C.blue,bold:true});text(s,p[1],x+0.24,3.38,3.40,1.19,{fontSize:18});});
text(s,'Alternativa elegida: C, por redundancia de modalidades y menor exclusión.',1.02,5.70,11.30,0.52,{fontSize:18,bold:true});

s=base('06 · Colaboración: alcance real del prototipo',7);
box(s,0.78,1.77,11.80,2.48,C.ice,C.line);
text(s,'PACIENTE   →   SERVIDOR LOCAL   →   ROL MÉDICO SIMULADO',1.07,2.16,11.20,0.65,{fontSize:23,bold:true,align:'center',color:C.blue});
text(s,'Crear caso y código  ·  consultar bandeja  ·  confirmar recepción  ·  responder  ·  consultar historial',1.19,3.06,10.98,0.70,{fontSize:16,align:'center'});
text(s,'No implementa videollamada, chat instantáneo, autenticación clínica ni conexión remota entre equipos.',0.96,5.07,11.45,1.1,{fontSize:19,color:C.red,bold:true});

s=base('07 · Pruebas de integración',8);
box(s,0.88,1.74,4.11,3.84,C.ice,C.blue);
text(s,'12 / 12',1.17,2.48,3.51,1.1,{fontSize:54,bold:true,color:C.blue,align:'center'});
text(s,'pruebas automáticas aprobadas',1.23,3.88,3.43,0.92,{fontSize:18,align:'center'});
bullet(s,'Flujo paciente → médico → paciente.',5.28,1.92,7.12,{fontSize:17});
bullet(s,'Ocho escrituras simultáneas persistidas.',5.28,2.88,7.12,{fontSize:17});
bullet(s,'Recepción y respuestas idempotentes.',5.28,3.84,7.12,{fontSize:17});
bullet(s,'Validación de respuestas y errores HTTP.',5.28,4.80,7.12,{fontSize:17});
text(s,'No se presentan como pruebas clínicas o ensayos con pacientes.',1.04,6.22,11.21,0.43,{fontSize:15,color:C.red});

s=base('08 · Límites y trabajo pendiente',9);
const pending=['Evaluación de usabilidad con personas voluntarias y criterios medibles.','Autenticación, roles clínicos, privacidad y seguridad de datos reales.','Validación lingüística; quechua está simulado.','Conectividad entre equipos, seguimiento clínico y despliegue remoto.','Capturas actualizadas y video de sustentación de cada integrante.'];
pending.forEach((t,i)=>bullet(s,t,0.87,1.78+i*0.83,11.56,{fontSize:18}));
text(s,'Nunca utilizar datos reales de salud en esta versión educativa.',0.95,6.20,11.4,0.52,{fontSize:18,bold:true,color:C.red});

s=base('09 · Conclusión del Grupo 10',10);
box(s,0.88,1.88,11.55,3.30,C.ice,C.line);
text(s,'La integración conserva el diseño multimodal de LEC06/LEC07 y demuestra trazabilidad de información y confirmación entre dos roles simulados en un mismo servidor.',1.24,2.30,10.80,2.12,{fontSize:23,bold:true,align:'center'});
text(s,'Código y evidencias: github.com/CeSaRLoPeZArTeAgA/PC2_IHC_Grup10',1.08,5.80,11.17,0.48,{fontSize:16,color:C.blue,align:'center'});
fs.mkdirSync(path.resolve('presentacion'),{recursive:true});
pptx.writeFile({fileName:path.resolve('presentacion','PC2-TriageVoz-Rural-Grupo10.pptx')});
