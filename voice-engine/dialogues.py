"""Cuatro intercambios del mismo caso para comparar PERSONALIDADES, no evaluaciones clínicas."""
from prompts import PRESETS, build_prompt, validate_personality

FIXED_PATIENT = [
    'Hola, tengo dolor de cabeza y fiebre desde ayer.',
    'La fiebre parece moderada.',
    'También siento cansancio, pero no tengo dificultad para respirar.',
    'Sí, lo que he dicho es correcto.'
]

def example_dialogue(values):
    p = validate_personality(values)
    formal = p['formalidad'] >= 8
    warm = p['amabilidad'] >= 8 and p['empatia'] >= 9
    patient = FIXED_PATIENT
    a1 = ('Entiendo su situación. Gracias por comunicarlo. ¿Cómo describiría la intensidad de la molestia?' if formal else
          'Gracias por contármelo; entiendo que puede ser incómodo. ¿Cómo sientes la intensidad de la molestia?' if warm else
          'Entendido. ¿Cómo describirías la intensidad de la molestia?')
    a2 = ('Registrado. ¿Presenta algún otro síntoma que desee mencionar?' if formal else
          'Gracias, vamos poco a poco. ¿Notas algún otro síntoma?' if warm else
          'De acuerdo. ¿Tienes algún otro síntoma?')
    a3 = ('He registrado el cansancio y su respuesta sobre la respiración. Prepararé un resumen orientativo. ¿Desea revisarlo?' if formal else
          'Gracias por aclararlo. Tengo anotado el cansancio y lo que me dices sobre respirar. ¿Revisamos juntos el resumen?' if warm else
          'Registrado. ¿Revisamos el resumen de síntomas?')
    a4 = ('Datos confirmados. Comparta este resumen con personal sanitario para su revisión; no constituye un diagnóstico.' if formal else
          'Gracias por confirmarlo. Puedes mostrar el resumen al personal de salud; aquí no hacemos diagnósticos.' if warm else
          'Resumen confirmado. Revísalo con un profesional de salud; no es un diagnóstico.')
    out=[]
    for i,(u,a) in enumerate(zip(patient,(a1,a2,a3,a4)),start=1):
        out.append({'turno':i,'paciente':u,'asistente':a})
    return out

def all_examples():
    return [{'name':name,'personality':settings,'prompt':build_prompt(settings),
             'dialogue':example_dialogue(settings),'source':'ejemplo_ilustrativo'}
            for name,settings in PRESETS.items()]
