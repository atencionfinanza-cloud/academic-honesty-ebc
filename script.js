/* Academic Honesty · prototipo educativo.
   Calificaciones y apartados se guardan solo en localStorage del navegador.
   No se transmiten datos a EBC ni a un equipo de apoyo. */
"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
// Aislamiento local por perfil: cada estudiante usa claves propias en este navegador.
// La sesión se escribe por auth.js antes de mostrar la sección del estudiante.
const profileStorageKey = (key) => {
  let session = null;
  try { session = JSON.parse(localStorage.getItem("ah_demo_session_v1") || "null"); } catch {}
  const profile = session?.role === "student" && session.id ? String(session.id) : "admin-demo";
  return `${key}__${profile}`;
};
const safeParse = (key, fallback = []) => {
  try { const value = JSON.parse(localStorage.getItem(profileStorageKey(key)) || "null"); return Array.isArray(value) ? value : fallback; }
  catch { return fallback; }
};
const persist = (key, value) => {
  try { localStorage.setItem(profileStorageKey(key), JSON.stringify(value)); return true; }
  catch { return false; }
};
const esc = (value) => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const showToast = (message) => {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3200);
};

// Responsive navigation
$("#nav-toggle").addEventListener("click", () => {
  const nav = $("#main-nav");
  const open = nav.classList.toggle("open");
  $("#nav-toggle").setAttribute("aria-expanded", String(open));
  $("#nav-toggle").setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
});
$$(".main-nav a").forEach(link => link.addEventListener("click", () => {
  $("#main-nav").classList.remove("open");
  $("#nav-toggle").setAttribute("aria-expanded", "false");
}));

// Progress tracker
const GRADE_KEY = "ah_v2_grades";
let grades = safeParse(GRADE_KEY).filter(g => g && typeof g.subject === "string" && Number.isFinite(Number(g.grade)));
const gradeForm = $("#grade-form");
const gradeStatus = $("#grade-status");
const updateFeedback = (average, list) => {
  const title = $("#feedback-title"), text = $("#feedback-text"), next = $("#next-step-text");
  const lowest = [...list].sort((a,b) => Number(a.grade) - Number(b.grade))[0];
  if (average >= 90) {
    title.textContent = "Tu esfuerzo está dando resultados.";
    text.textContent = "Tu promedio registrado refleja un desempeño alto. Mantén los hábitos que te funcionan y busca oportunidades para profundizar, no solo para obtener una nota.";
    next.textContent = "Elige una materia en la que puedas retarte más: explica un tema a alguien o aplica lo aprendido a un caso real.";
  } else if (average >= 80) {
    title.textContent = "Vas por buen camino.";
    text.textContent = "Tienes una base sólida y todavía hay espacio para fortalecer algunos temas. Convierte las calificaciones en información útil, no en una etiqueta.";
    next.textContent = `Revisa qué te ayudó en tus mejores resultados y define una acción concreta para reforzar ${lowest ? lowest.subject : "la materia que más te cuesta"}.`;
  } else if (average >= 70) {
    title.textContent = "Hay avances que puedes construir.";
    text.textContent = "Tu promedio sugiere que conviene revisar qué contenidos o hábitos requieren atención. Pedir una explicación a tiempo también es una decisión responsable.";
    next.textContent = `Prioriza ${lowest ? lowest.subject : "la materia que más te cuesta"}: identifica dos temas por repasar y agenda una sesión breve de estudio o consulta.`;
  } else {
    title.textContent = "Es buen momento para buscar apoyo.";
    text.textContent = "Una calificación no define tu capacidad. Sí puede ser una señal para cambiar de estrategia, revisar los criterios de evaluación y pedir orientación antes de que se acumulen las dudas.";
    next.textContent = `Empieza por ${lowest ? lowest.subject : "la materia que te preocupa"}: contacta a tu docente, pregunta qué mejorar y acuerda un primer paso realista.`;
  }
};
function renderGrades() {
  const list = $("#grades-list");
  list.replaceChildren();
  if (!grades.length) {
    list.innerHTML = '<li class="empty-state">Todavía no hay calificaciones.</li>';
    $("#average").textContent = "—";
    $("#average-circle").innerHTML = "<span>—</span><small>/100</small>";
    $("#average-bar").style.width = "0%";
    $("#feedback-title").textContent = "Todo empieza con un registro.";
    $("#feedback-text").textContent = "Agrega tu primera calificación para recibir una retroalimentación inicial.";
    $("#next-step-text").textContent = "Registra una materia para empezar a identificar patrones.";
    $("#grade-count").textContent = "0 materias";
    $("#clear-grades").hidden = true;
    return;
  }
  const avg = grades.reduce((sum, g) => sum + Number(g.grade), 0) / grades.length;
  const shown = (Math.round(avg * 10) / 10).toString();
  $("#average").textContent = shown;
  $("#average-circle").innerHTML = `<span>${Math.round(avg)}</span><small>/100</small>`;
  $("#average-bar").style.width = `${Math.max(0, Math.min(100, avg))}%`;
  $("#grade-count").textContent = `${grades.length} ${grades.length === 1 ? "materia" : "materias"}`;
  $("#clear-grades").hidden = false;
  updateFeedback(avg, grades);
  [...grades].reverse().forEach(g => {
    const li = document.createElement("li");
    li.className = "grade-item";
    const details = document.createElement("div");
    details.className = "grade-details";
    const subject = document.createElement("span");
    subject.className = "grade-subject"; subject.textContent = g.subject;
    const meta = document.createElement("span");
    meta.className = "grade-meta"; meta.textContent = `Calificación final · ${g.date}`;
    details.append(subject, meta);
    const score = document.createElement("div"); score.className = "grade-score";
    const val = document.createElement("span"); val.textContent = Number(g.grade).toLocaleString("es-MX", {maximumFractionDigits:1});
    const del = document.createElement("button"); del.type = "button"; del.className = "delete-grade"; del.textContent = "×"; del.setAttribute("aria-label", `Eliminar calificación de ${g.subject}`);
    del.addEventListener("click", () => {
      grades = grades.filter(x => x.id !== g.id);
      persist(GRADE_KEY, grades); renderGrades(); showToast("Calificación eliminada de este navegador.");
    });
    score.append(val, del); li.append(details, score); list.append(li);
  });
}
gradeForm.addEventListener("submit", event => {
  event.preventDefault();
  const subject = $("#subject").value.trim();
  const grade = Number($("#grade").value);
  if (!subject || !Number.isFinite(grade) || grade < 0 || grade > 100) {
    gradeStatus.textContent = "Escribe una materia y una calificación entre 0 y 100."; return;
  }
  grades.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, subject, grade, date: new Date().toLocaleDateString("es-MX") });
  if (!persist(GRADE_KEY, grades)) {
    grades.pop(); gradeStatus.textContent = "No se pudo guardar. Revisa la configuración de almacenamiento de tu navegador."; return;
  }
  renderGrades();
  gradeForm.reset();
  gradeStatus.textContent = "Calificación agregada. Tu retroalimentación se actualizó.";
});
$("#clear-grades").addEventListener("click", () => {
  if (!grades.length) return;
  if (confirm("¿Borrar todas las calificaciones guardadas en este navegador? Esta acción no se puede deshacer.")) {
    grades = []; persist(GRADE_KEY, grades); renderGrades(); gradeStatus.textContent = "Tus registros locales se borraron.";
  }
});
renderGrades();

// Event registration demo (local only)
const EVENTS = {
  integridad: { title: "¿Qué significa ser íntegro?", date: "22 de octubre de 2026" },
  dilemas: { title: "Dilemas académicos", date: "5 de noviembre de 2026" },
  ayuda: { title: "Cómo pedir ayuda a tiempo", date: "19 de noviembre de 2026" }
};
const REG_KEY = "ah_v2_event_registrations";
let registrations = safeParse(REG_KEY);
const dialog = $("#register-dialog");
function renderRegistrations() {
  const list = $("#my-registrations"); list.replaceChildren();
  if (!registrations.length) {
    list.innerHTML = '<li class="empty-state">Todavía no has apartado ningún lugar en este navegador.</li>'; return;
  }
  registrations.forEach(reg => {
    const li = document.createElement("li"); li.className = "registration-item";
    const title = document.createElement("strong"); title.textContent = reg.eventTitle;
    const meta = document.createElement("span"); meta.textContent = `${reg.date} · ${reg.name}`;
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "cancel-registration"; cancel.textContent = "Eliminar apartado local";
    cancel.addEventListener("click", () => {
      registrations = registrations.filter(r => r.id !== reg.id);
      persist(REG_KEY, registrations); renderRegistrations(); showToast("Apartado eliminado de este navegador.");
    });
    li.append(title, meta, cancel); list.append(li);
  });
}
$$(".register-trigger").forEach(button => button.addEventListener("click", () => {
  const eventInfo = EVENTS[button.dataset.event];
  if (!eventInfo) return;
  $("#register-event-id").value = button.dataset.event;
  $("#register-event-name").textContent = `${eventInfo.title} · ${eventInfo.date}`;
  $("#register-status").textContent = "";
  $("#register-form").reset();
  $("#register-event-id").value = button.dataset.event;
  if (dialog.showModal) dialog.showModal(); else alert("Tu navegador no admite el formulario emergente. Prueba con un navegador actualizado.");
}));
$("#register-form").addEventListener("submit", event => {
  event.preventDefault();
  const eventId = $("#register-event-id").value, eventInfo = EVENTS[eventId];
  const name = $("#register-name").value.trim(), email = $("#register-email").value.trim().toLowerCase();
  if (!eventInfo || !name || !email) return;
  // Do not hard-code an EBC email domain without institutional confirmation.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $("#register-status").textContent = "Escribe un correo válido."; return;
  }
  if (registrations.some(r => r.eventId === eventId && r.email === email)) {
    $("#register-status").textContent = "Este correo ya tiene un apartado local para ese evento."; return;
  }
  const reg = { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, eventId, eventTitle: eventInfo.title, date: eventInfo.date, name, email };
  registrations.push(reg);
  if (!persist(REG_KEY, registrations)) {
    registrations.pop(); $("#register-status").textContent = "No se pudo guardar el apartado en este navegador."; return;
  }
  renderRegistrations(); dialog.close(); showToast("Apartado guardado localmente. No es una reserva confirmada.");
});
renderRegistrations();

// Ethical quests: 3 scenarios, 5 questions each
const quests = [
  {
    label: "QUEST 01 · EL TRABAJO PRESTADO",
    title: "El trabajo prestado",
    questions: [
      { title:"Tienes una entrega importante y vas atrasado.", context:"Un compañero te ofrece compartir su trabajo para que lo uses como base. La fecha límite está cerca y sabes que copiarlo sería más rápido.", options:[
        ["a","Copio partes y cambio algunas palabras para entregar a tiempo.",{integrity:0,empathy:0,responsibility:0},"Evita reconocer el problema y puede comprometer el aprendizaje y la confianza."],
        ["b","Le pido el archivo solo para entender la estructura y escribo mi propio trabajo, citando cualquier idea que use.",{integrity:2,empathy:1,responsibility:2},"Aprovechas la colaboración sin presentar el trabajo ajeno como propio."],
        ["c","Explico al docente mi situación y pregunto qué opciones honestas tengo.",{integrity:2,empathy:1,responsibility:2},"La comunicación temprana te permite asumir la responsabilidad y buscar una solución legítima."]
      ]},
      { title:"Descubres que una idea de tu borrador viene de una fuente que no citaste.", context:"Todavía puedes corregir la entrega. No sabes si alguien lo notará, pero sabes que la fuente influyó en tu argumento.", options:[
        ["a","La cito y reviso si debo corregir otras partes antes de entregar.",{integrity:2,empathy:1,responsibility:2},"Reconocer las fuentes hace visible qué ideas son tuyas y cuáles provienen de otros."],
        ["b","La dejo como está porque la idea está expresada con mis palabras.",{integrity:0,empathy:0,responsibility:0},"Parafrasear no elimina la necesidad de reconocer la fuente de una idea."],
        ["c","Quito la idea sin revisar si hay otras referencias pendientes.",{integrity:1,empathy:0,responsibility:1},"Eliminarla puede ayudar, pero conviene revisar el documento completo para evitar omisiones similares."]
      ]},
      { title:"Tu equipo dice que todos copian un poco y que no pasa nada.", context:"Te preocupa que defender tu postura genere tensión con tus compañeros.", options:[
        ["a","Acepto para evitar problemas con el equipo.",{integrity:0,empathy:1,responsibility:0},"La presión social explica la dificultad, pero no elimina las consecuencias de la decisión."],
        ["b","Propongo repartir tareas, citar fuentes y entregar un trabajo propio.",{integrity:2,empathy:2,responsibility:2},"Ofreces una alternativa concreta que protege el trabajo colectivo y la integridad."],
        ["c","Acuso al equipo delante de todos sin hablar antes con ellos.",{integrity:1,empathy:0,responsibility:1},"Poner límites puede ser necesario, pero una conversación clara y segura suele ser un primer paso más constructivo."]
      ]},
      { title:"Te das cuenta de que ya entregaste un archivo con una cita incorrecta.", context:"La evaluación todavía no termina. Te da vergüenza admitir el error.", options:[
        ["a","No digo nada y espero que no lo detecten.",{integrity:0,empathy:0,responsibility:0},"Ocultar el error evita la conversación, pero no corrige la información."],
        ["b","Escribo al docente, explico el error y envío la corrección si es posible.",{integrity:2,empathy:1,responsibility:2},"La transparencia permite corregir el problema y aprender del proceso."],
        ["c","Pido a un compañero que diga que él hizo esa parte.",{integrity:0,empathy:0,responsibility:0},"Trasladar la responsabilidad puede perjudicar a otra persona y agravar el problema."]
      ]},
      { title:"¿Qué harías para que no vuelva a pasar?", context:"Piensa en una acción práctica que puedas mantener durante el semestre.", options:[
        ["a","Dejo las tareas para el último día y resuelvo sobre la marcha.",{integrity:0,empathy:0,responsibility:0},"La urgencia aumenta la presión y hace más difícil tomar buenas decisiones."],
        ["b","Planifico avances, registro mis fuentes y pido ayuda cuando me atasco.",{integrity:2,empathy:1,responsibility:2},"Un sistema sencillo reduce la presión y hace más fácil trabajar con honestidad."],
        ["c","Evito colaborar con cualquier persona para no tener problemas.",{integrity:1,empathy:0,responsibility:1},"La colaboración puede ser positiva cuando se aclaran límites, aportaciones y fuentes."]
      ]}
    ],
    tips:["Define qué tipo de colaboración permite cada tarea antes de empezar.","Guarda las fuentes mientras investigas, no al final.","Si cometiste un error, busca corregirlo con transparencia."]
  },
  {
    label: "QUEST 02 · EL MÉRITO COMPARTIDO",
    title: "El mérito compartido",
    questions: [
      { title:"Tu equipo prepara una presentación y una persona hizo casi todo el trabajo.", context:"La calificación será grupal y el equipo propone que todos digan que contribuyeron por igual.", options:[
        ["a","Acepto para evitar una discusión antes de exponer.",{integrity:0,empathy:1,responsibility:0},"Evitar el conflicto puede parecer cómodo, pero borra aportaciones y responsabilidades reales."],
        ["b","Propongo reconocer las contribuciones de cada persona y repartir lo que falta.",{integrity:2,empathy:2,responsibility:2},"Reconocer el trabajo real permite ser justo y todavía organizarse como equipo."],
        ["c","Expongo públicamente a quien no trabajó sin darle oportunidad de explicar.",{integrity:1,empathy:0,responsibility:1},"La rendición de cuentas importa, pero conviene distinguir entre falta de participación y una dificultad no conocida."]
      ]},
      { title:"Una persona no ha respondido al equipo desde hace varios días.", context:"No sabes si está evitando el trabajo o si atraviesa alguna situación personal.", options:[
        ["a","Le escribo en privado, pregunto si necesita algo y aclaro qué falta.",{integrity:2,empathy:2,responsibility:2},"Combinas empatía con claridad sobre los compromisos."],
        ["b","Hago su parte y digo que todo el equipo colaboró igual.",{integrity:0,empathy:1,responsibility:0},"Resolver el trabajo puede ayudar a corto plazo, pero no refleja la contribución real ni resuelve el patrón."],
        ["c","La elimino del equipo sin conversar ni revisar las reglas.",{integrity:1,empathy:0,responsibility:1},"A veces se necesitan límites, pero primero conviene usar los acuerdos y canales disponibles."]
      ]},
      { title:"La presentación recibe elogios por una idea que propusiste tú.", context:"Un compañero empieza a hablar como si la idea hubiera sido suya.", options:[
        ["a","Lo corrijo con calma y explico cómo construimos esa idea entre todos.",{integrity:2,empathy:2,responsibility:2},"Defiendes el reconocimiento justo sin convertirlo en un ataque personal."],
        ["b","Me quedo callado y después intento quedarme con todo el crédito.",{integrity:0,empathy:0,responsibility:0},"Responder a una injusticia con otra no restaura la confianza."],
        ["c","Lo confronto delante de todos con insultos.",{integrity:1,empathy:0,responsibility:1},"Es válido aclarar la autoría, pero el tono puede distraer del asunto principal."]
      ]},
      { title:"El docente pregunta cómo se dividieron las tareas.", context:"El reparto fue desigual, pero el equipo quiere dar una respuesta vaga.", options:[
        ["a","Explico con honestidad las aportaciones y qué ajustes hicimos al final.",{integrity:2,empathy:1,responsibility:2},"Una explicación precisa permite aprender del proceso y evita atribuciones falsas."],
        ["b","Invento una división equilibrada para que nadie quede mal.",{integrity:0,empathy:1,responsibility:0},"La intención de proteger a otros no convierte una afirmación falsa en justa."],
        ["c","Culpo solo a una persona y omito mis propias decisiones.",{integrity:0,empathy:0,responsibility:0},"La responsabilidad compartida requiere reconocer también tu papel en el proceso."]
      ]},
      { title:"¿Qué acuerdo evitaría que vuelva a ocurrir?", context:"Piensa en una práctica sencilla para futuros trabajos grupales.", options:[
        ["a","Acordar tareas, fechas, evidencias de aportación y qué hacer si alguien se retrasa.",{integrity:2,empathy:2,responsibility:2},"Los acuerdos previos reducen confusiones y hacen más justo el reparto."],
        ["b","Esperar a ver quién trabaja más y decidir al final.",{integrity:0,empathy:0,responsibility:0},"Sin expectativas compartidas, el problema puede repetirse y generar resentimiento."],
        ["c","Dejar que una persona decida todo para avanzar rápido.",{integrity:1,empathy:0,responsibility:1},"Puede ser eficiente a corto plazo, pero limita la participación y la rendición de cuentas."]
      ]}
    ],
    tips:["Acuerden tareas, plazos y canales de comunicación desde el primer día.","Reconoce aportaciones concretas, sin exagerar ni minimizar.","Si el equipo no logra resolverlo, consulta los criterios del docente."]
  },
  {
    label: "QUEST 03 · LA CIFRA CONVENIENTE",
    title: "La cifra conveniente",
    questions: [
      { title:"Tu equipo prepara un proyecto y los datos no apoyan la conclusión deseada.", context:"Cambiar algunos valores haría que la presentación se vea más convincente.", options:[
        ["a","Ajusto los números sin decirlo para que el proyecto parezca exitoso.",{integrity:0,empathy:0,responsibility:0},"Alterar datos puede llevar a decisiones equivocadas y dañar la confianza."],
        ["b","Presento los resultados reales y explico sus límites y lo que falta investigar.",{integrity:2,empathy:2,responsibility:2},"La honestidad incluye explicar la evidencia aunque no confirme la hipótesis inicial."],
        ["c","Quito los resultados incómodos sin explicar por qué.",{integrity:0,empathy:0,responsibility:0},"Omitir datos relevantes puede crear una impresión engañosa, aunque no se cambien los números."]
      ]},
      { title:"Una fuente contradice la idea central de tu presentación.", context:"Tu exposición tiene poco tiempo y no sabes si mencionar el desacuerdo.", options:[
        ["a","La incluyo y explico por qué la evidencia puede diferir.",{integrity:2,empathy:1,responsibility:2},"Considerar evidencia contraria demuestra análisis crítico y evita presentar una visión incompleta."],
        ["b","La ignoro porque podría confundir al público.",{integrity:0,empathy:0,responsibility:0},"Simplificar no justifica ocultar información que cambiaría la interpretación."],
        ["c","La menciono como si apoyara mi postura.",{integrity:0,empathy:0,responsibility:0},"Representar una fuente de forma contraria a su contenido es engañoso."]
      ]},
      { title:"Tu líder te pide que no expliques una limitación importante.", context:"Dice que el equipo podría perder puntos si admite que el proyecto tiene debilidades.", options:[
        ["a","Propongo explicar la limitación y qué haríamos para mejorarla.",{integrity:2,empathy:2,responsibility:2},"Reconocer límites puede hacer la propuesta más creíble y útil."],
        ["b","Acepto porque la decisión final no es mía.",{integrity:0,empathy:0,responsibility:0},"La presión jerárquica es real, pero no elimina tu responsabilidad de comunicar con honestidad."],
        ["c","Publico una acusación en redes antes de intentar resolverlo.",{integrity:1,empathy:0,responsibility:1},"Si hay una conducta seria, puede requerir escalarse; primero conserva evidencias y usa un canal apropiado y seguro."]
      ]},
      { title:"Detectas un error en un dato después de exponer.", context:"El error no cambió toda la conclusión, pero sí afecta una parte del análisis.", options:[
        ["a","Corrijo el dato y aviso a quienes recibieron la presentación.",{integrity:2,empathy:1,responsibility:2},"Corregir con claridad limita la propagación del error y demuestra responsabilidad."],
        ["b","No hago nada porque probablemente nadie lo notó.",{integrity:0,empathy:0,responsibility:0},"Que un error pase desapercibido no elimina su impacto potencial."],
        ["c","Cambio el archivo y finjo que nunca hubo una versión anterior.",{integrity:0,empathy:0,responsibility:0},"Actualizar el archivo sin comunicar una corrección puede dejar a otros con información incorrecta."]
      ]},
      { title:"¿Qué práctica fortalecería la credibilidad del equipo?", context:"Elige una rutina que puedas aplicar en otros proyectos.", options:[
        ["a","Verificar fuentes, documentar cambios y separar datos de interpretaciones.",{integrity:2,empathy:2,responsibility:2},"Una trazabilidad sencilla ayuda a revisar el trabajo y explicar de dónde sale cada conclusión."],
        ["b","Usar solo datos que confirmen la conclusión del equipo.",{integrity:0,empathy:0,responsibility:0},"Buscar únicamente confirmación aumenta el riesgo de sesgo y decisiones deficientes."],
        ["c","Pedir a otra persona que revise al final, sin compartir las fuentes.",{integrity:1,empathy:1,responsibility:1},"Una revisión ayuda, pero debe tener acceso a la evidencia y a los criterios usados."]
      ]}
    ],
    tips:["Separa claramente hechos, interpretaciones y recomendaciones.","Documenta fuentes, correcciones y decisiones del equipo.","Presentar límites con transparencia puede aumentar la credibilidad."]
  }
];
let currentQuest = 0, questionIndex = 0, answers = [];
const questLabel = $("#quest-label"), questionCounter = $("#question-counter"), progressBar = $("#quest-progress-bar");
function selectQuest(index) {
  currentQuest = index; questionIndex = 0; answers = [];
  $$(".quest-choice").forEach((button, i) => { button.classList.toggle("active", i === index); button.setAttribute("aria-pressed", String(i === index)); });
  $("#quest-result").hidden = true; $("#quest-stage").hidden = false;
  renderQuestion();
}
function renderQuestion() {
  const quest = quests[currentQuest], q = quest.questions[questionIndex];
  questLabel.textContent = quest.label;
  questionCounter.textContent = `Pregunta ${questionIndex + 1} de ${quest.questions.length}`;
  progressBar.style.width = `${((questionIndex + 1) / quest.questions.length) * 100}%`;
  $("#question-title").textContent = q.title;
  $("#question-context").textContent = q.context;
  const fieldset = $("#answer-options"); fieldset.replaceChildren();
  const legend = document.createElement("legend"); legend.textContent = "¿Qué harías?"; fieldset.append(legend);
  q.options.forEach((option, i) => {
    const label = document.createElement("label"); label.className = "answer-option";
    const input = document.createElement("input"); input.type = "radio"; input.name = "quest-answer"; input.value = option[0];
    if (answers[questionIndex] === option[0]) { input.checked = true; label.classList.add("selected"); }
    const copy = document.createElement("span");
    const strong = document.createElement("strong"); strong.textContent = `Opción ${String.fromCharCode(65+i)}`;
    copy.append(strong, document.createTextNode(option[1]));
    label.append(input, copy); fieldset.append(label);
    input.addEventListener("change", () => {
      answers[questionIndex] = option[0];
      $$(".answer-option", fieldset).forEach(x => x.classList.toggle("selected", $("input", x).checked));
      $("#quest-next").disabled = false; $("#answer-status").textContent = "";
    });
  });
  $("#quest-back").disabled = questionIndex === 0;
  $("#quest-next").textContent = questionIndex === quest.questions.length - 1 ? "Ver mi retroalimentación ↗" : "Confirmar y continuar →";
  $("#quest-next").disabled = !answers[questionIndex];
  $("#answer-status").textContent = "";
}
$$(".quest-choice").forEach(button => button.addEventListener("click", () => selectQuest(Number(button.dataset.quest))));
$("#quest-back").addEventListener("click", () => { if (questionIndex > 0) { questionIndex--; renderQuestion(); } });
$("#quest-next").addEventListener("click", () => {
  if (!answers[questionIndex]) { $("#answer-status").textContent = "Selecciona una opción para continuar."; return; }
  if (questionIndex < quests[currentQuest].questions.length - 1) { questionIndex++; renderQuestion(); }
  else showQuestResult();
});
function showQuestResult() {
  const quest = quests[currentQuest];
  const selected = quest.questions.map((q, i) => q.options.find(opt => opt[0] === answers[i])).filter(Boolean);
  const max = quest.questions.length * 2;
  const totals = { integrity: 0, empathy: 0, responsibility: 0 };
  selected.forEach(opt => { totals.integrity += opt[2].integrity; totals.empathy += opt[2].empathy; totals.responsibility += opt[2].responsibility; });
  const percent = key => Math.round((totals[key] / max) * 100);
  const overall = Math.round(((totals.integrity + totals.empathy + totals.responsibility) / (max * 3)) * 100);
  $("#result-title").textContent = overall >= 85 ? "Tus decisiones muestran una intención responsable." : overall >= 60 ? "Hay buenas bases y algunas tensiones que vale la pena revisar." : "Este escenario revela decisiones que puedes reconsiderar.";
  $("#result-summary").textContent = `En “${quest.title}”, tus elecciones reflejan un ${percent("integrity")}% de consideración de la integridad, un ${percent("empathy")}% de perspectiva hacia otras personas y un ${percent("responsibility")}% de responsabilidad. No es una calificación moral: es una guía para observar tus criterios y explorar alternativas.`;
  $("#result-integrity").textContent = `${percent("integrity")}%`;
  $("#result-empathy").textContent = `${percent("empathy")}%`;
  $("#result-responsibility").textContent = `${percent("responsibility")}%`;
  const tips = $("#result-tips"); tips.replaceChildren();
  quest.tips.forEach(tip => { const li = document.createElement("li"); li.textContent = tip; tips.append(li); });
  $("#quest-stage").hidden = true; $("#quest-result").hidden = false;
  progressBar.style.width = "100%"; questionCounter.textContent = "Quest completado";
}
$("#quest-restart").addEventListener("click", () => selectQuest(currentQuest));
$("#quest-next-scenario").addEventListener("click", () => selectQuest((currentQuest + 1) % quests.length));
selectQuest(0);

// Safe space: tailored local guidance only; message never stored or transmitted.
const safeForm = $("#safe-form");
$("#safe-message").addEventListener("input", () => $("#char-count").textContent = $("#safe-message").value.length);
const guidance = {
  academico: { title:"Empieza por ordenar el problema.", text:"No tienes que resolver todo a la vez. Identificar la parte más difícil puede ayudarte a pedir una orientación concreta.", steps:["Escribe cuál es la tarea o tema que te está costando, sin datos personales.","Divide el trabajo en un primer paso de 15–20 minutos.","Contacta a tu docente, asesoría académica o una persona de confianza para acordar cómo avanzar."] },
  integridad: { title:"Reconocer una duda o un error ya es un primer paso.", text:"La honestidad académica no exige saberlo todo; sí invita a actuar con transparencia y corregir cuando sea posible.", steps:["Revisa las instrucciones de la actividad y las reglas de citación o colaboración.","Conserva tu propio trabajo y evita alterar o borrar información para ocultar lo ocurrido.","Habla con el docente o el área académica pertinente para explicar la situación y preguntar por las opciones disponibles."] },
  conflicto: { title:"Busca claridad sin dejar de cuidarte.", text:"Los conflictos de equipo pueden mejorar con acuerdos específicos; si hay intimidación o no te sientes seguro, prioriza tu seguridad.", steps:["Anota para ti los hechos, fechas y acuerdos relevantes, sin difundirlos públicamente.","Si es seguro, plantea qué necesitas y propón un acuerdo concreto.","Si no se resuelve o hay represalias, pide orientación a un docente o coordinación."] },
  presion: { title:"Tu seguridad y tu dignidad son importantes.", text:"No tienes que manejar la presión, el acoso o el trato injusto a solas. Busca apoyo de una persona o canal institucional confiable.", steps:["Si puedes, aléjate de la situación inmediata y busca un lugar seguro.","Habla con una persona de confianza o con un área institucional de atención; comparte solo lo necesario.","Si existe peligro inmediato, llama al 911 en México. Este formulario no se supervisa en tiempo real."] },
  bienestar: { title:"Puedes dar un paso pequeño y pedir compañía.", text:"El estrés puede sentirse abrumador. No necesitas esperar a que empeore para buscar orientación.", steps:["Identifica qué necesitas resolver primero y qué puede esperar.","Habla con alguien de confianza o solicita orientación profesional o institucional.","Si sientes que podrías hacerte daño o estás en peligro, busca ayuda inmediata de los servicios de emergencia o una persona cercana."] },
  otro: { title:"Empieza por la ayuda que te haga sentir más seguro.", text:"Aunque no tengas claro cómo nombrar lo que ocurre, puedes pedir orientación sin compartir más de lo que quieras.", steps:["Piensa qué te gustaría que cambiara o qué necesitas para sentirte mejor.","Busca a una persona de confianza o al área institucional que corresponda.","Comparte la información de forma gradual y pregunta cómo se manejará antes de dar datos personales."] }
};
safeForm.addEventListener("submit", event => {
  event.preventDefault();
  const topic = $("#safe-topic").value, urgency = $("#safe-urgency").value;
  if (!topic || !urgency || !$("#safe-consent").checked) return;
  const base = guidance[topic] || guidance.otro;
  $("#safe-response-title").textContent = urgency === "riesgo" ? "Prioriza tu seguridad ahora." : urgency === "pronto" ? "Busca una conversación pronto." : base.title;
  let intro = base.text;
  let steps = [...base.steps];
  if (urgency === "riesgo") {
    intro = "Este sitio no puede alertar a nadie ni ofrecer atención inmediata. Si no estás a salvo ahora, busca ayuda en persona y contacta a emergencias.";
    steps = ["Si estás en México y hay peligro inmediato, llama al 911.","Ve a un lugar seguro y contacta a una persona de confianza que pueda acompañarte.","No esperes una respuesta de esta página: el formulario no envía mensajes ni se supervisa."];
  } else if (urgency === "pronto") {
    steps.unshift("Intenta contactar hoy a una persona de confianza, docente o área institucional de orientación.");
  }
  $("#safe-response-text").textContent = intro;
  const list = $("#safe-response-list"); list.replaceChildren();
  steps.forEach(step => { const li = document.createElement("li"); li.textContent = step; list.append(li); });
  $("#safe-response").hidden = false;
  $("#safe-status").textContent = "Orientación generada localmente. Tu mensaje no se ha enviado ni guardado.";
  $("#safe-response").scrollIntoView({ behavior: "smooth", block: "nearest" });
});
$("#safe-reset").addEventListener("click", () => {
  safeForm.reset(); $("#char-count").textContent = "0"; $("#safe-response").hidden = true; $("#safe-status").textContent = "";
});

// Close dialog by clicking outside, if supported
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
