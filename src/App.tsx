import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudLightning,
  Compass,
  Droplets,
  ExternalLink,
  Flame,
  Gauge,
  Globe2,
  GraduationCap,
  Layers3,
  ListFilter,
  MapPin,
  Mountain,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Snowflake,
  ThermometerSun,
  Wind,
} from 'lucide-react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import clsx from 'clsx'
import './App.css'

type CategoryId =
  | 'earthquake'
  | 'wildfire'
  | 'storm'
  | 'volcano'
  | 'flood'
  | 'drought'
  | 'ice'
  | 'dust'
  | 'landslide'
  | 'temperature'
  | 'other'

type SourceId = 'nasa' | 'usgs'
type SourceFilter = 'all' | SourceId
type CategoryFilter = 'all' | CategoryId
type SeverityLevel = 'observacion' | 'media' | 'alta' | 'critica'
type TimeWindow = 'day' | 'week' | 'month'
type LearningTab = 'science' | 'signals' | 'safety'

interface DisasterEvent {
  id: string
  title: string
  category: CategoryId
  coordinates: [number, number]
  date: Date
  updated?: Date
  source: SourceId
  sourceName: string
  sourceUrl?: string
  status: string
  place?: string
  magnitude?: number
  depthKm?: number
  severity: SeverityLevel
  summary: string
  rawCategory?: string
}

interface CategoryInfo {
  label: string
  shortLabel: string
  color: string
  softColor: string
  icon: LucideIcon
  science: string
  signals: string[]
  safety: string[]
}

interface GeoJsonGeometry {
  type?: string
  coordinates?: unknown
}

interface EonetFeature {
  type: string
  properties?: {
    id?: string
    title?: string
    description?: string | null
    link?: string
    closed?: string | null
    categories?: Array<{ id?: string; title?: string }>
    geometryDates?: string[]
  }
  geometry?: GeoJsonGeometry | null
}

interface EonetResponse {
  features?: EonetFeature[]
}

interface UsgsFeature {
  id?: string
  properties?: {
    mag?: number | null
    place?: string | null
    time?: number | null
    updated?: number | null
    url?: string | null
    alert?: string | null
    status?: string | null
    tsunami?: number | null
    sig?: number | null
    title?: string | null
  }
  geometry?: {
    type?: string
    coordinates?: [number, number, number?]
  } | null
}

interface UsgsResponse {
  metadata?: {
    generated?: number
    title?: string
    count?: number
  }
  features?: UsgsFeature[]
}

const CATEGORY_INFO: Record<CategoryId, CategoryInfo> = {
  earthquake: {
    label: 'Terremotos',
    shortLabel: 'Sismo',
    color: '#c0392b',
    softColor: '#fde7df',
    icon: Activity,
    science:
      'Un terremoto libera energia acumulada en fallas de la corteza. La magnitud resume esa energia y la profundidad influye en que tan fuerte se siente en superficie.',
    signals: ['Magnitud y profundidad', 'Ubicacion del epicentro', 'Posible alerta de tsunami'],
    safety: ['Agacharse, cubrirse y sujetarse', 'Alejarse de ventanas', 'Evacuar solo cuando el movimiento termine'],
  },
  wildfire: {
    label: 'Incendios',
    shortLabel: 'Fuego',
    color: '#df6b1f',
    softColor: '#fff0d8',
    icon: Flame,
    science:
      'Los incendios forestales avanzan segun combustible vegetal, humedad, viento y pendiente. Los satelites ayudan a detectar calor y humo desde el espacio.',
    signals: ['Focos de calor', 'Humo visible', 'Viento seco o cambiante'],
    safety: ['Seguir rutas oficiales', 'Usar mascarilla ante humo', 'No volver a zonas evacuadas sin autorizacion'],
  },
  storm: {
    label: 'Tormentas',
    shortLabel: 'Tormenta',
    color: '#2d6cdf',
    softColor: '#e5f0ff',
    icon: CloudLightning,
    science:
      'Las tormentas severas concentran viento, lluvia y electricidad atmosferica. En ciclones, la energia viene del oceano calido y puede afectar regiones enormes.',
    signals: ['Trayectoria y velocidad', 'Lluvia acumulada', 'Viento sostenido'],
    safety: ['Refugiarse bajo techo firme', 'Evitar rios y pasos bajo nivel', 'Cargar linternas y baterias'],
  },
  volcano: {
    label: 'Volcanes',
    shortLabel: 'Volcan',
    color: '#7b4b2a',
    softColor: '#f2e5d9',
    icon: Mountain,
    science:
      'Un volcan puede liberar lava, ceniza y gases. La ceniza viaja con el viento y puede afectar agua, agricultura, respiracion y vuelos.',
    signals: ['Columna de ceniza', 'Sismicidad local', 'Gases y deformacion del terreno'],
    safety: ['Proteger ojos y vias respiratorias', 'Cubrir depositos de agua', 'Respetar zonas de exclusion'],
  },
  flood: {
    label: 'Inundaciones',
    shortLabel: 'Agua',
    color: '#008891',
    softColor: '#dff7f5',
    icon: Droplets,
    science:
      'Una inundacion ocurre cuando el agua supera la capacidad del suelo, rios o drenajes. La lluvia intensa y el deshielo pueden acelerar el proceso.',
    signals: ['Nivel de rios', 'Lluvia persistente', 'Suelos saturados'],
    safety: ['Subir a zonas altas', 'No cruzar agua en movimiento', 'Desconectar energia si es seguro'],
  },
  drought: {
    label: 'Sequias',
    shortLabel: 'Sequia',
    color: '#a45d13',
    softColor: '#fff4d6',
    icon: ThermometerSun,
    science:
      'La sequia es falta prolongada de agua disponible. Puede aparecer lentamente y afectar alimentos, energia, salud y ecosistemas.',
    signals: ['Deficit de lluvia', 'Bajo caudal', 'Aumento de temperatura'],
    safety: ['Ahorrar agua', 'Cuidar cultivos y animales', 'Evitar quemas en zonas secas'],
  },
  ice: {
    label: 'Hielo y nieve',
    shortLabel: 'Hielo',
    color: '#5f8fb8',
    softColor: '#e7f6ff',
    icon: Snowflake,
    science:
      'Los cambios de hielo, nieve e icebergs muestran condiciones oceanicas y climaticas. Tambien pueden afectar rutas maritimas y comunidades costeras.',
    signals: ['Deriva de hielo', 'Temperatura del mar', 'Extension de nieve'],
    safety: ['Evitar superficies congeladas inestables', 'Preparar abrigo', 'Revisar rutas antes de viajar'],
  },
  dust: {
    label: 'Polvo y humo',
    shortLabel: 'Aire',
    color: '#8d6e63',
    softColor: '#f0e6dc',
    icon: Wind,
    science:
      'El polvo y el humo viajan con masas de aire. Pueden reducir visibilidad, cambiar la calidad del aire y transportar particulas a largas distancias.',
    signals: ['Visibilidad baja', 'Indice de calidad del aire', 'Direccion del viento'],
    safety: ['Cerrar ventanas', 'Evitar ejercicio intenso afuera', 'Usar proteccion respiratoria si es necesario'],
  },
  landslide: {
    label: 'Deslizamientos',
    shortLabel: 'Ladera',
    color: '#6f7042',
    softColor: '#edf0d7',
    icon: Compass,
    science:
      'Un deslizamiento ocurre cuando suelo o roca pierde estabilidad. La lluvia, sismos, pendientes fuertes y construcciones pueden aumentar el riesgo.',
    signals: ['Grietas nuevas', 'Arboles inclinados', 'Ruidos o movimiento en laderas'],
    safety: ['Alejarse de laderas inestables', 'No dormir junto a taludes', 'Reportar grietas o hundimientos'],
  },
  temperature: {
    label: 'Temperatura extrema',
    shortLabel: 'Calor/frio',
    color: '#b83280',
    softColor: '#fde7f3',
    icon: ThermometerSun,
    science:
      'El calor o frio extremo estresa el cuerpo humano, la energia y los ecosistemas. El riesgo crece cuando dura varios dias seguidos.',
    signals: ['Maximas o minimas anomalas', 'Humedad alta', 'Duracion del evento'],
    safety: ['Hidratarse y buscar sombra', 'Revisar a personas vulnerables', 'Evitar esfuerzo en horas criticas'],
  },
  other: {
    label: 'Otros eventos',
    shortLabel: 'Evento',
    color: '#5f6673',
    softColor: '#eceff3',
    icon: AlertTriangle,
    science:
      'Algunos eventos naturales no encajan en una sola categoria. Mirar fuente, ubicacion y fecha ayuda a entender su impacto real.',
    signals: ['Fuente del dato', 'Fecha de observacion', 'Region afectada'],
    safety: ['Buscar informacion oficial local', 'Preparar un plan familiar', 'Compartir solo datos verificados'],
  },
}

const EONET_CATEGORY_MAP: Record<string, CategoryId> = {
  wildfires: 'wildfire',
  severeStorms: 'storm',
  volcanoes: 'volcano',
  floods: 'flood',
  drought: 'drought',
  seaLakeIce: 'ice',
  snow: 'ice',
  dustHaze: 'dust',
  landslides: 'landslide',
  temperatureExtremes: 'temperature',
  waterColor: 'other',
  manmade: 'other',
}

const TIME_WINDOWS: Record<TimeWindow, { label: string; eonetDays: number; usgsUrl: string; detail: string }> = {
  day: {
    label: '24 h',
    eonetDays: 1,
    usgsUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    detail: 'Sismos M2.5+',
  },
  week: {
    label: '7 dias',
    eonetDays: 7,
    usgsUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
    detail: 'Sismos M2.5+',
  },
  month: {
    label: '30 dias',
    eonetDays: 30,
    usgsUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson',
    detail: 'Sismos M4.5+',
  },
}

const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  observacion: 'Observacion',
  media: 'Atencion media',
  alta: 'Atencion alta',
  critica: 'Critico',
}

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  observacion: 1,
  media: 2,
  alta: 3,
  critica: 4,
}

const SOURCE_LABEL: Record<SourceFilter, string> = {
  all: 'Todas',
  nasa: 'NASA EONET',
  usgs: 'USGS',
}

const QUIZ_ITEMS = [
  {
    category: 'earthquake' as CategoryId,
    question: 'En un sismo, que dato ayuda a estimar la energia liberada?',
    options: ['Magnitud', 'Color del mapa', 'Nombre de la ciudad'],
    answer: 0,
    explanation: 'La magnitud resume la energia liberada. La profundidad y distancia ayudan a estimar el impacto local.',
  },
  {
    category: 'wildfire' as CategoryId,
    question: 'Que condicion suele acelerar un incendio forestal?',
    options: ['Viento seco', 'Noche despejada', 'Suelo plano sin vegetacion'],
    answer: 0,
    explanation: 'El viento seco aporta oxigeno, seca combustible vegetal y empuja el frente de fuego.',
  },
  {
    category: 'storm' as CategoryId,
    question: 'Por que una tormenta puede causar inundaciones lejos del mar?',
    options: ['Por lluvia intensa acumulada', 'Porque baja la gravedad', 'Porque todos los rios se congelan'],
    answer: 0,
    explanation: 'La lluvia intensa puede superar la capacidad de rios, suelos y drenajes urbanos.',
  },
  {
    category: 'volcano' as CategoryId,
    question: 'Que parte de una erupcion puede viajar cientos de kilometros?',
    options: ['Ceniza volcanica', 'Roca solida gigante', 'El crater completo'],
    answer: 0,
    explanation: 'La ceniza fina puede ser transportada por el viento y afectar salud, agua y transporte aereo.',
  },
  {
    category: 'flood' as CategoryId,
    question: 'Cual es una accion segura durante una crecida?',
    options: ['No cruzar agua en movimiento', 'Entrar a tuneles', 'Acercarse a la orilla para grabar'],
    answer: 0,
    explanation: 'Poca profundidad puede tener mucha fuerza. Evitar cruzar protege de arrastres y objetos ocultos.',
  },
]

function App() {
  const [events, setEvents] = useState<DisasterEvent[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errors, setErrors] = useState<string[]>([])
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('week')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [learningTab, setLearningTab] = useState<LearningTab>('science')
  const [quizStep, setQuizStep] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState<{ key: string; index: number } | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setStatus('loading')
      const result = await loadDisasterData(timeWindow, controller.signal)
      if (controller.signal.aborted) {
        return
      }

      setEvents(result.events)
      setErrors(result.errors)
      setLastLoaded(new Date())
      setStatus(result.events.length > 0 ? 'ready' : 'error')
    }

    load().catch((error: unknown) => {
      if (controller.signal.aborted) {
        return
      }

      setErrors([error instanceof Error ? error.message : 'No se pudieron cargar los datos'])
      setStatus('error')
    })

    return () => controller.abort()
  }, [reloadKey, timeWindow])

  const filteredEvents = useMemo(() => {
    const cleanQuery = normalizeText(query)

    return events
      .filter((event) => sourceFilter === 'all' || event.source === sourceFilter)
      .filter((event) => categoryFilter === 'all' || event.category === categoryFilter)
      .filter((event) => {
        if (!cleanQuery) {
          return true
        }

        return normalizeText(`${event.title} ${event.place ?? ''} ${CATEGORY_INFO[event.category].label}`).includes(cleanQuery)
      })
      .sort((first, second) => {
        const severityDelta = SEVERITY_ORDER[second.severity] - SEVERITY_ORDER[first.severity]
        if (severityDelta !== 0) {
          return severityDelta
        }
        return second.date.getTime() - first.date.getTime()
      })
  }, [categoryFilter, events, query, sourceFilter])

  const selectedEvent = useMemo(() => {
    return filteredEvents.find((event) => event.id === selectedId) ?? filteredEvents[0] ?? null
  }, [filteredEvents, selectedId])

  const categoryCounts = useMemo(() => {
    return events.reduce(
      (counts, event) => {
        counts[event.category] = (counts[event.category] ?? 0) + 1
        return counts
      },
      {} as Partial<Record<CategoryId, number>>,
    )
  }, [events])

  const stats = useMemo(() => {
    const strongestQuake = events
      .filter((event) => event.category === 'earthquake' && typeof event.magnitude === 'number')
      .reduce<DisasterEvent | null>((current, event) => {
        if (!current || (event.magnitude ?? 0) > (current.magnitude ?? 0)) {
          return event
        }
        return current
      }, null)

    return {
      total: filteredEvents.length,
      activeGlobal: events.length,
      highAttention: filteredEvents.filter((event) => ['alta', 'critica'].includes(event.severity)).length,
      strongestQuake,
      sources: new Set(events.map((event) => event.source)).size,
    }
  }, [events, filteredEvents])

  const quiz = useMemo(() => {
    const categoryQuiz = QUIZ_ITEMS.find((item) => item.category === selectedEvent?.category)
    return categoryQuiz ?? QUIZ_ITEMS[quizStep % QUIZ_ITEMS.length]
  }, [quizStep, selectedEvent?.category])
  const quizKey = `${quiz.category}-${quiz.question}-${quizStep}`
  const selectedQuizAnswer = quizAnswer?.key === quizKey ? quizAnswer.index : null

  const refreshData = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  return (
    <main className="app-shell">
      <section className="intro-band">
        <div className="intro-inner">
          <header className="topbar">
            <div className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">
                <Globe2 size={24} />
              </span>
              <div>
                <p className="eyebrow">Observatorio educativo</p>
                <h1>Atlas Vivo de Desastres Naturales</h1>
              </div>
            </div>
            <div className="live-status" aria-live="polite">
              <Radio size={17} />
              <span>{status === 'loading' ? 'Actualizando datos' : 'Datos cercanos al tiempo real'}</span>
            </div>
          </header>

          <div className="intro-grid">
            <div className="intro-copy">
              <p>
                Explora eventos naturales activos y recientes en el planeta con datos publicos de NASA EONET y USGS.
                El mapa destaca ubicacion, tipo de evento, fecha observada y conceptos clave para aprender ciencia
                de riesgos sin sensacionalismo.
              </p>
            </div>
            <div className="source-strip" aria-label="Fuentes de datos">
              <span>
                <Layers3 size={16} /> NASA EONET
              </span>
              <span>
                <Activity size={16} /> USGS Earthquakes
              </span>
              <span>
                <MapPin size={16} /> OpenStreetMap
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="control-band" aria-label="Filtros de exploracion">
        <div className="controls-inner">
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pais, zona o evento"
              type="search"
            />
          </div>

          <div className="segmented-group" aria-label="Periodo de datos">
            {Object.entries(TIME_WINDOWS).map(([key, item]) => (
              <button
                key={key}
                type="button"
                className={clsx('segment', timeWindow === key && 'active')}
                onClick={() => setTimeWindow(key as TimeWindow)}
                title={item.detail}
              >
                <Clock3 size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="segmented-group" aria-label="Fuente">
            {(['all', 'nasa', 'usgs'] as SourceFilter[]).map((source) => (
              <button
                key={source}
                type="button"
                className={clsx('segment', sourceFilter === source && 'active')}
                onClick={() => setSourceFilter(source)}
              >
                <span>{SOURCE_LABEL[source]}</span>
              </button>
            ))}
          </div>

          <button type="button" className="icon-button" onClick={refreshData} disabled={status === 'loading'} title="Actualizar">
            <RefreshCw size={18} className={clsx(status === 'loading' && 'spin')} />
          </button>
        </div>
      </section>

      <section className="metrics-band" aria-label="Resumen">
        <div className="metrics-grid">
          <Metric icon={Globe2} label="Eventos visibles" value={formatNumber(stats.total)} detail={`${stats.activeGlobal} cargados`} />
          <Metric icon={Gauge} label="Atencion alta" value={formatNumber(stats.highAttention)} detail="Nivel educativo, no alerta oficial" />
          <Metric
            icon={Activity}
            label="Mayor sismo"
            value={stats.strongestQuake?.magnitude ? `M${stats.strongestQuake.magnitude.toFixed(1)}` : 'Sin datos'}
            detail={stats.strongestQuake?.place ?? 'USGS feed'}
          />
          <Metric
            icon={Radio}
            label="Actualizacion"
            value={lastLoaded ? relativeTime(lastLoaded) : 'Cargando'}
            detail={`${stats.sources || 0} fuentes activas`}
          />
        </div>
      </section>

      <section className="category-band" aria-label="Categorias">
        <div className="category-scroll">
          <CategoryChip
            label="Todo"
            active={categoryFilter === 'all'}
            count={events.length}
            color="#273142"
            icon={ListFilter}
            onClick={() => setCategoryFilter('all')}
          />
          {(Object.keys(CATEGORY_INFO) as CategoryId[]).map((category) => {
            const info = CATEGORY_INFO[category]
            return (
              <CategoryChip
                key={category}
                label={info.shortLabel}
                active={categoryFilter === category}
                count={categoryCounts[category] ?? 0}
                color={info.color}
                icon={info.icon}
                onClick={() => setCategoryFilter(category)}
              />
            )
          })}
        </div>
      </section>

      <section className="explorer-grid">
        <div className="map-surface">
          <div className="surface-heading">
            <div>
              <p className="eyebrow">Mapa global</p>
              <h2>Eventos monitoreados</h2>
            </div>
            <span className="time-note">{TIME_WINDOWS[timeWindow].detail}</span>
          </div>

          <DisasterMap events={filteredEvents} selectedEvent={selectedEvent} onSelect={setSelectedId} />

          {errors.length > 0 && (
            <div className="data-warning" role="status">
              <AlertTriangle size={18} />
              <span>{errors.join(' ')}</span>
            </div>
          )}
        </div>

        <aside className="event-surface" aria-label="Lista de eventos">
          <div className="surface-heading compact">
            <div>
              <p className="eyebrow">Lista priorizada</p>
              <h2>{formatNumber(filteredEvents.length)} resultados</h2>
            </div>
          </div>

          <div className="event-list">
            {filteredEvents.length === 0 && <EmptyState status={status} />}
            {filteredEvents.slice(0, 90).map((event) => (
              <EventListItem
                key={event.id}
                event={event}
                active={event.id === selectedEvent?.id}
                onClick={() => setSelectedId(event.id)}
              />
            ))}
          </div>
        </aside>
      </section>

      <section className="learning-band">
        <article className="detail-surface">
          {selectedEvent ? (
            <SelectedEventPanel event={selectedEvent} />
          ) : (
            <div className="empty-detail">
              <Compass size={24} />
              <p>No hay eventos para los filtros actuales.</p>
            </div>
          )}
        </article>

        <article className="learning-surface">
          <div className="surface-heading compact">
            <div>
              <p className="eyebrow">Aula rapida</p>
              <h2>{selectedEvent ? CATEGORY_INFO[selectedEvent.category].label : 'Conceptos clave'}</h2>
            </div>
            <GraduationCap size={22} />
          </div>

          <div className="tab-row" role="tablist" aria-label="Aprendizaje">
            {([
              ['science', 'Ciencia'],
              ['signals', 'Senales'],
              ['safety', 'Seguridad'],
            ] as Array<[LearningTab, string]>).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={learningTab === tab}
                className={clsx('tab-button', learningTab === tab && 'active')}
                onClick={() => setLearningTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          <LearningContent category={selectedEvent?.category ?? 'other'} tab={learningTab} />
        </article>

        <article className="quiz-surface">
          <div className="surface-heading compact">
            <div>
              <p className="eyebrow">Reto</p>
              <h2>Pregunta express</h2>
            </div>
            <BookOpen size={22} />
          </div>

          <div className="quiz-card">
            <p className="quiz-question">{quiz.question}</p>
            <div className="quiz-options">
              {quiz.options.map((option, index) => {
                const isSelected = selectedQuizAnswer === index
                const isCorrect = selectedQuizAnswer !== null && index === quiz.answer
                return (
                  <button
                    key={option}
                    type="button"
                    className={clsx('quiz-option', isSelected && 'selected', isCorrect && 'correct')}
                    onClick={() => setQuizAnswer({ key: quizKey, index })}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            {selectedQuizAnswer !== null && (
              <div className="quiz-feedback">
                {selectedQuizAnswer === quiz.answer ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{quiz.explanation}</span>
              </div>
            )}
            <button
              type="button"
              className="next-button"
              onClick={() => {
                setQuizStep((current) => current + 1)
                setQuizAnswer(null)
              }}
            >
              Siguiente <ChevronRight size={17} />
            </button>
          </div>
        </article>
      </section>

      <footer className="footer-band">
        <p>
          Datos: <a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noreferrer">NASA EONET</a>,{' '}
          <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/" target="_blank" rel="noreferrer">USGS Earthquake Feeds</a> y{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>.
          Los niveles de atencion son estimaciones educativas de esta app.
        </p>
      </footer>
    </main>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  )
}

function CategoryChip({
  label,
  active,
  count,
  color,
  icon: Icon,
  onClick,
}: {
  label: string
  active: boolean
  count: number
  color: string
  icon: LucideIcon
  onClick: () => void
}) {
  return (
    <button type="button" className={clsx('category-chip', active && 'active')} onClick={onClick} style={{ '--chip-color': color } as CSSProperties}>
      <Icon size={17} />
      <span>{label}</span>
      <strong>{formatNumber(count)}</strong>
    </button>
  )
}

function DisasterMap({
  events,
  selectedEvent,
  onSelect,
}: {
  events: DisasterEvent[]
  selectedEvent: DisasterEvent | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="map-wrap">
      <MapContainer center={[12, 0]} zoom={2} minZoom={2} maxZoom={8} scrollWheelZoom className="leaflet-map" worldCopyJump>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFocus event={selectedEvent} />
        {events.map((event) => {
          const info = CATEGORY_INFO[event.category]
          const isSelected = event.id === selectedEvent?.id
          return (
            <CircleMarker
              key={event.id}
              center={event.coordinates}
              radius={markerRadius(event, isSelected)}
              pathOptions={{
                color: isSelected ? '#121826' : info.color,
                weight: isSelected ? 3 : 2,
                fillColor: info.color,
                fillOpacity: isSelected ? 0.88 : 0.58,
              }}
              eventHandlers={{ click: () => onSelect(event.id) }}
            >
              <Tooltip direction="top" opacity={0.96}>
                <strong>{event.title}</strong>
                <span>{CATEGORY_INFO[event.category].label}</span>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}

function MapFocus({ event }: { event: DisasterEvent | null }) {
  const map = useMap()

  useEffect(() => {
    if (!event) {
      return
    }

    map.flyTo(event.coordinates, Math.max(map.getZoom(), 4), {
      duration: 0.7,
    })
  }, [event, map])

  return null
}

function EventListItem({ event, active, onClick }: { event: DisasterEvent; active: boolean; onClick: () => void }) {
  const info = CATEGORY_INFO[event.category]
  const Icon = info.icon

  return (
    <button type="button" className={clsx('event-item', active && 'active')} onClick={onClick}>
      <span className="event-type" style={{ '--event-color': info.color } as CSSProperties}>
        <Icon size={17} />
      </span>
      <span className="event-copy">
        <strong>{event.title}</strong>
        <span>
          {info.shortLabel} · {event.sourceName} · {relativeTime(event.date)}
        </span>
      </span>
      <span className={clsx('severity-pill', event.severity)}>{SEVERITY_LABEL[event.severity]}</span>
    </button>
  )
}

function SelectedEventPanel({ event }: { event: DisasterEvent }) {
  const info = CATEGORY_INFO[event.category]
  const Icon = info.icon

  return (
    <>
      <div className="selected-hero" style={{ '--selected-color': info.color, '--selected-soft': info.softColor } as CSSProperties}>
        <div className="selected-icon" aria-hidden="true">
          <Icon size={28} />
        </div>
        <div>
          <p className="eyebrow">Evento seleccionado</p>
          <h2>{event.title}</h2>
          <span>{info.label}</span>
        </div>
      </div>

      <p className="event-summary">{event.summary}</p>

      <div className="detail-grid">
        <DetailCell label="Fuente" value={event.sourceName} />
        <DetailCell label="Estado" value={event.status} />
        <DetailCell label="Fecha" value={formatDate(event.date)} />
        <DetailCell label="Coordenadas" value={`${event.coordinates[0].toFixed(2)}, ${event.coordinates[1].toFixed(2)}`} />
        {typeof event.magnitude === 'number' && <DetailCell label="Magnitud" value={`M${event.magnitude.toFixed(1)}`} />}
        {typeof event.depthKm === 'number' && <DetailCell label="Profundidad" value={`${event.depthKm.toFixed(1)} km`} />}
      </div>

      <div className="action-row">
        {event.sourceUrl && (
          <a className="source-link" href={event.sourceUrl} target="_blank" rel="noreferrer">
            Ver fuente <ExternalLink size={16} />
          </a>
        )}
        <span className={clsx('severity-pill', event.severity)}>{SEVERITY_LABEL[event.severity]}</span>
      </div>
    </>
  )
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function LearningContent({ category, tab }: { category: CategoryId; tab: LearningTab }) {
  const info = CATEGORY_INFO[category]

  if (tab === 'science') {
    return <p className="learning-text">{info.science}</p>
  }

  const items = tab === 'signals' ? info.signals : info.safety
  return (
    <ul className="learning-list">
      {items.map((item) => (
        <li key={item}>
          <ShieldCheck size={17} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function EmptyState({ status }: { status: 'loading' | 'ready' | 'error' }) {
  return (
    <div className="empty-state">
      {status === 'loading' ? <RefreshCw size={22} className="spin" /> : <Search size={22} />}
      <strong>{status === 'loading' ? 'Cargando datos' : 'Sin resultados'}</strong>
      <span>{status === 'loading' ? 'Consultando fuentes publicas.' : 'Ajusta busqueda, periodo o categoria.'}</span>
    </div>
  )
}

async function loadDisasterData(timeWindow: TimeWindow, signal: AbortSignal) {
  const eonetUrl = `https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=${TIME_WINDOWS[timeWindow].eonetDays}&limit=250`
  const usgsUrl = TIME_WINDOWS[timeWindow].usgsUrl

  const [eonetResult, usgsResult] = await Promise.allSettled([
    fetchJson<EonetResponse>(eonetUrl, signal),
    fetchJson<UsgsResponse>(usgsUrl, signal),
  ])

  const errors: string[] = []
  const events: DisasterEvent[] = []

  if (eonetResult.status === 'fulfilled') {
    events.push(...normalizeEonet(eonetResult.value))
  } else if (!signal.aborted) {
    errors.push('NASA EONET no respondio en este intento.')
  }

  if (usgsResult.status === 'fulfilled') {
    events.push(...normalizeUsgs(usgsResult.value))
  } else if (!signal.aborted) {
    errors.push('USGS no respondio en este intento.')
  }

  events.sort((first, second) => second.date.getTime() - first.date.getTime())

  return { events, errors }
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/geo+json, application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al consultar ${url}`)
  }

  return response.json() as Promise<T>
}

function normalizeEonet(response: EonetResponse): DisasterEvent[] {
  const events = (response.features ?? [])
    .map((feature, index): DisasterEvent | null => {
      const props = feature.properties
      const coordinates = getRepresentativeCoordinate(feature.geometry)
      if (!props || !coordinates) {
        return null
      }

      const rawCategory = props.categories?.[0]?.id ?? 'other'
      const category = EONET_CATEGORY_MAP[rawCategory] ?? 'other'
      const observedDate = latestDate(props.geometryDates) ?? new Date()
      const title = props.title?.trim() || `Evento NASA ${index + 1}`
      const sourceUrl = safeUrl(props.link)

      return {
        id: `nasa-${props.id ?? index}`,
        title,
        category,
        coordinates,
        date: observedDate,
        updated: observedDate,
        source: 'nasa' as SourceId,
        sourceName: 'NASA EONET',
        sourceUrl,
        status: props.closed ? 'Cerrado' : 'Activo',
        severity: estimateEonetSeverity(category, observedDate),
        summary:
          props.description?.trim() ||
          `Evento de ${CATEGORY_INFO[category].label.toLowerCase()} registrado por NASA EONET. La posicion corresponde a una observacion satelital o punto representativo del evento.`,
        rawCategory,
      }
    })
    .filter((event): event is DisasterEvent => event !== null)

  return Array.from(
    events
      .reduce((deduped, event) => {
        const current = deduped.get(event.id)
        if (!current || event.date.getTime() > current.date.getTime()) {
          deduped.set(event.id, event)
        }
        return deduped
      }, new Map<string, DisasterEvent>())
      .values(),
  )
}

function normalizeUsgs(response: UsgsResponse): DisasterEvent[] {
  return (response.features ?? [])
    .map((feature, index): DisasterEvent | null => {
      const props = feature.properties
      const coords = feature.geometry?.coordinates

      if (!props || !coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
        return null
      }

      const magnitude = typeof props.mag === 'number' ? props.mag : undefined
      const depthKm = typeof coords[2] === 'number' ? coords[2] : undefined
      const date = props.time ? new Date(props.time) : new Date()
      const place = props.place?.trim() || 'Ubicacion no especificada'
      const sourceUrl = safeUrl(props.url)

      return {
        id: `usgs-${feature.id ?? index}`,
        title: props.title?.trim() || `${magnitude ? `M${magnitude.toFixed(1)} ` : ''}${place}`,
        category: 'earthquake' as CategoryId,
        coordinates: [coords[1], coords[0]] as [number, number],
        date,
        updated: props.updated ? new Date(props.updated) : undefined,
        source: 'usgs' as SourceId,
        sourceName: 'USGS',
        sourceUrl,
        status: props.status === 'reviewed' ? 'Revisado' : 'Automatico',
        place,
        magnitude,
        depthKm,
        severity: estimateEarthquakeSeverity(magnitude, props.alert, props.tsunami),
        summary: `Sismo ${magnitude ? `de magnitud ${magnitude.toFixed(1)}` : 'registrado'} cerca de ${place}${
          typeof depthKm === 'number' ? `, a ${depthKm.toFixed(1)} km de profundidad` : ''
        }.`,
      }
    })
    .filter((event): event is DisasterEvent => event !== null)
}

function estimateEarthquakeSeverity(magnitude?: number, alert?: string | null, tsunami?: number | null): SeverityLevel {
  if (alert === 'red' || alert === 'orange' || tsunami === 1 || (magnitude ?? 0) >= 7) {
    return 'critica'
  }
  if (alert === 'yellow' || (magnitude ?? 0) >= 5.8) {
    return 'alta'
  }
  if ((magnitude ?? 0) >= 4.5) {
    return 'media'
  }
  return 'observacion'
}

function estimateEonetSeverity(category: CategoryId, observedDate: Date): SeverityLevel {
  const hoursOld = (Date.now() - observedDate.getTime()) / 36e5
  if (['storm', 'wildfire', 'volcano', 'flood'].includes(category) && hoursOld <= 96) {
    return 'alta'
  }
  if (['storm', 'wildfire', 'volcano', 'flood', 'drought', 'temperature', 'landslide'].includes(category)) {
    return 'media'
  }
  return 'observacion'
}

function latestDate(values?: string[]) {
  const dates = (values ?? [])
    .map(parseDate)
    .filter((date): date is Date => date !== null)
    .sort((first, second) => second.getTime() - first.getTime())

  return dates[0] ?? null
}

function parseDate(value: string) {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function getRepresentativeCoordinate(geometry?: GeoJsonGeometry | null): [number, number] | null {
  if (!geometry?.coordinates) {
    return null
  }

  const pairs: Array<[number, number]> = []

  function walk(value: unknown) {
    if (!Array.isArray(value)) {
      return
    }

    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const lon = value[0]
      const lat = value[1]
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        pairs.push([lat, lon])
      }
      return
    }

    value.forEach(walk)
  }

  walk(geometry.coordinates)

  if (pairs.length === 0) {
    return null
  }

  if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
    return pairs[pairs.length - 1]
  }

  const totals = pairs.reduce(
    (sum, pair) => {
      sum.lat += pair[0]
      sum.lon += pair[1]
      return sum
    },
    { lat: 0, lon: 0 },
  )

  return [totals.lat / pairs.length, totals.lon / pairs.length]
}

function markerRadius(event: DisasterEvent, selected: boolean) {
  const base = selected ? 10 : 6
  if (event.category === 'earthquake' && event.magnitude) {
    return Math.min(18, base + event.magnitude * 1.2)
  }
  return base + SEVERITY_ORDER[event.severity] * 1.5
}

function safeUrl(value?: string | null) {
  if (!value) {
    return undefined
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CL').format(value)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function relativeTime(date: Date) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.345, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ]

  let duration = seconds
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }

  return 'fecha reciente'
}

export default App
