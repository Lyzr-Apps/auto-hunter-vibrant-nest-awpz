'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent, type AIAgentResponse } from '@/lib/aiAgent'
import { uploadAndTrainDocument, getDocuments, deleteDocuments, validateFile } from '@/lib/ragKnowledgeBase'
import { listSchedules, getScheduleLogs, pauseSchedule, resumeSchedule, cronToHuman, triggerScheduleNow, type Schedule, type ExecutionLog } from '@/lib/scheduler'
import { cn } from '@/lib/utils'

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

import {
  Loader2,
  Play,
  RefreshCw,
  Upload,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  BarChart3,
  Briefcase,
  User,
  Bell,
  Calendar,
  ChevronRight,
  Search,
  Settings,
  Zap,
  Target,
  TrendingUp,
  Send,
  Shield,
  ArrowUpRight,
  Filter,
  SortAsc,
  Mail,
  MapPin,
  DollarSign,
  Star,
  Eye,
  SkipForward,
  Activity,
  Home,
  X,
  Info,
  MessageCircle,
  ExternalLink,
  Hash,
  Bot,
  Smartphone
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_ORCHESTRATOR_ID = '69a000f26a4eb8f58312baf7'
const HUMAN_INTERVENTION_ID = '69a001258e73c9f97733b283'
const ANALYTICS_FEEDBACK_ID = '69a00112f4446d4de57fdc24'
const RAG_ID = '69a000a900c2d274880efd04'
const PIPELINE_SCHEDULE_ID = '69a0012f25d4d77f732e4319'
const ANALYTICS_SCHEDULE_ID = '69a0013025d4d77f732e431a'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ApplicationPackage {
  job_title: string
  company: string
  score: string
  application_method: string
  status: string
  resume_customized: string
  cover_letter_ready: string
}

interface PipelineData {
  pipeline_status: string
  total_jobs_discovered: string
  total_jobs_qualified: string
  total_applications_prepared: string
  auto_apply_count: string
  review_needed_count: string
  pipeline_summary: string
  application_packages: ApplicationPackage[]
}

interface InterventionData {
  intervention_type: string
  affected_application: string
  company: string
  description: string
  action_required: string
  system_state: string
  notification_sent: string
  notification_method: string
  telegram_sent?: string
  timestamp: string
}

interface Recommendation {
  category: string
  suggestion: string
  impact: string
}

interface ApplicationTrend {
  week: string
  applications_sent: string
  interviews_received: string
  conversion_rate: string
}

interface AnalyticsData {
  total_applications: string
  interview_rate: string
  top_performing_skills: string
  scoring_adjustments: string
  weekly_summary: string
  recommendations: Recommendation[]
  application_trends: ApplicationTrend[]
}

interface Notification {
  type: 'success' | 'error' | 'info'
  message: string
  id: number
}

interface ProfilePreferences {
  targetRoles: string
  skills: string
  salaryMin: string
  salaryMax: string
  locations: string
  workAuth: string
}

// ─── Agent Definitions ────────────────────────────────────────────────────────

const AGENTS = [
  { id: PIPELINE_ORCHESTRATOR_ID, name: 'Job Pipeline Orchestrator', role: 'Coordinates end-to-end pipeline' },
  { id: '69a000da9853b5a45a209da0', name: 'Job Discovery', role: 'Discovers and filters job listings' },
  { id: '69a000db6a4eb8f58312baed', name: 'Job Scoring & Matching', role: 'Scores jobs against profile' },
  { id: '69a000db881ff4d2ab212068', name: 'Resume & Cover Letter', role: 'Customizes application materials' },
  { id: '69a000db5c89478b3d077140', name: 'Application Strategy', role: 'Determines best apply method' },
  { id: HUMAN_INTERVENTION_ID, name: 'Human Intervention', role: 'Handles CAPTCHAs, OTPs, blockers' },
  { id: ANALYTICS_FEEDBACK_ID, name: 'Analytics & Feedback', role: 'Generates performance analytics' },
]

// ─── Sample Data ──────────────────────────────────────────────────────────────

const SAMPLE_PIPELINE: PipelineData = {
  pipeline_status: 'Completed',
  total_jobs_discovered: '47',
  total_jobs_qualified: '12',
  total_applications_prepared: '8',
  auto_apply_count: '5',
  review_needed_count: '3',
  pipeline_summary: 'Pipeline completed successfully. Discovered 47 jobs across LinkedIn, Indeed, and Glassdoor. After scoring against your profile, 12 jobs qualified with scores above 65. Customized resumes and cover letters for the top 8 matches. 5 applications were auto-submitted via quick-apply, and 3 require your review before submission.',
  application_packages: [
    { job_title: 'Senior Frontend Engineer', company: 'Stripe', score: '92', application_method: 'Quick Apply', status: 'Auto-Applied', resume_customized: 'Yes', cover_letter_ready: 'Yes' },
    { job_title: 'Staff Software Engineer', company: 'Figma', score: '88', application_method: 'Direct Email', status: 'Auto-Applied', resume_customized: 'Yes', cover_letter_ready: 'Yes' },
    { job_title: 'Full Stack Developer', company: 'Vercel', score: '87', application_method: 'Portal', status: 'Auto-Applied', resume_customized: 'Yes', cover_letter_ready: 'Yes' },
    { job_title: 'Lead Frontend Developer', company: 'Notion', score: '85', application_method: 'Quick Apply', status: 'Auto-Applied', resume_customized: 'Yes', cover_letter_ready: 'Yes' },
    { job_title: 'Senior React Developer', company: 'Linear', score: '86', application_method: 'Quick Apply', status: 'Auto-Applied', resume_customized: 'Yes', cover_letter_ready: 'Yes' },
    { job_title: 'Platform Engineer', company: 'Datadog', score: '78', application_method: 'Portal', status: 'Pending Review', resume_customized: 'Yes', cover_letter_ready: 'Yes' },
    { job_title: 'Software Engineer II', company: 'Airbnb', score: '72', application_method: 'Direct Email', status: 'Pending Review', resume_customized: 'Yes', cover_letter_ready: 'No' },
    { job_title: 'Frontend Architect', company: 'Shopify', score: '68', application_method: 'Portal', status: 'Pending Review', resume_customized: 'Yes', cover_letter_ready: 'Yes' },
  ]
}

const SAMPLE_ANALYTICS: AnalyticsData = {
  total_applications: '34',
  interview_rate: '23.5%',
  top_performing_skills: 'React, TypeScript, Next.js, System Design, GraphQL',
  scoring_adjustments: 'Increased weight for remote-friendly roles by 15%. Reduced weight for salary outliers. Added bonus for companies with engineering blogs.',
  weekly_summary: 'Strong week with 8 new applications sent. Interview conversion rate improved by 3.2% compared to last week. Top-performing applications were to companies in the developer tools space. Consider expanding search to include DevOps-adjacent roles given your infrastructure experience.',
  recommendations: [
    { category: 'Resume', suggestion: 'Add quantified metrics to your most recent role - mention specific performance improvements', impact: 'High' },
    { category: 'Cover Letter', suggestion: 'Reference company blog posts or recent product launches to show genuine interest', impact: 'Medium' },
    { category: 'Search Strategy', suggestion: 'Expand to include "Platform Engineer" titles - your skill set aligns well', impact: 'High' },
    { category: 'Timing', suggestion: 'Apply within 24 hours of posting - early applications get 3x more callbacks', impact: 'Medium' },
  ],
  application_trends: [
    { week: 'Week 1', applications_sent: '6', interviews_received: '1', conversion_rate: '16.7%' },
    { week: 'Week 2', applications_sent: '8', interviews_received: '2', conversion_rate: '25.0%' },
    { week: 'Week 3', applications_sent: '12', interviews_received: '3', conversion_rate: '25.0%' },
    { week: 'Week 4', applications_sent: '8', interviews_received: '2', conversion_rate: '25.0%' },
  ]
}

const SAMPLE_INTERVENTIONS: InterventionData[] = [
  {
    intervention_type: 'CAPTCHA',
    affected_application: 'Senior Frontend Engineer',
    company: 'Stripe',
    description: 'reCAPTCHA challenge detected during application submission on the Stripe careers portal.',
    action_required: 'Please solve the CAPTCHA on the open browser window to continue the application. Send /resume Stripe via Telegram when done.',
    system_state: 'Paused at form submission step 3/4',
    notification_sent: 'Yes',
    notification_method: 'Telegram + Gmail',
    telegram_sent: 'Yes',
    timestamp: '2024-01-15T14:32:00Z'
  },
  {
    intervention_type: 'OTP Verification',
    affected_application: 'Platform Engineer',
    company: 'Datadog',
    description: 'Email OTP verification required to complete account creation on Datadog careers portal.',
    action_required: 'Check your email for a 6-digit verification code and enter it in the browser. Send /resume Datadog via Telegram when done.',
    system_state: 'Paused at account verification',
    notification_sent: 'Yes',
    notification_method: 'Telegram + Gmail',
    telegram_sent: 'Yes',
    timestamp: '2024-01-15T15:10:00Z'
  }
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAgentResponse(result: AIAgentResponse) {
  if (!result?.success) return null
  let data = result?.response?.result
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return null }
  }
  return data
}

function getScoreColor(scoreStr: string): string {
  const score = parseInt(scoreStr, 10)
  if (isNaN(score)) return 'bg-slate-500'
  if (score >= 85) return 'bg-emerald-500'
  if (score >= 65) return 'bg-amber-500'
  return 'bg-red-500'
}

function getScoreTextColor(scoreStr: string): string {
  const score = parseInt(scoreStr, 10)
  if (isNaN(score)) return 'text-slate-400'
  if (score >= 85) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-400'
  return 'text-red-400'
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status ?? '').toLowerCase()
  if (s.includes('auto') || s.includes('applied') || s.includes('approved')) return 'default'
  if (s.includes('pending') || s.includes('review')) return 'secondary'
  if (s.includes('skip') || s.includes('reject')) return 'destructive'
  return 'outline'
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-slate-400 mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-500 transition-colors">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Notification Banner ──────────────────────────────────────────────────────

function NotificationBanner({ notifications, onDismiss }: { notifications: Notification[]; onDismiss: (id: number) => void }) {
  if (notifications.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm animate-in fade-in slide-in-from-top-2',
            n.type === 'success' && 'bg-emerald-950/90 border-emerald-700 text-emerald-200',
            n.type === 'error' && 'bg-red-950/90 border-red-700 text-red-200',
            n.type === 'info' && 'bg-blue-950/90 border-blue-700 text-blue-200'
          )}
        >
          {n.type === 'success' && <CheckCircle className="h-4 w-4 shrink-0" />}
          {n.type === 'error' && <XCircle className="h-4 w-4 shrink-0" />}
          {n.type === 'info' && <Info className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{n.message}</span>
          <button onClick={() => onDismiss(n.id)} className="shrink-0 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  )
}

// ─── Pipeline Stage Indicator ─────────────────────────────────────────────────

function PipelineStages({ currentStage }: { currentStage: number }) {
  const stages = [
    { name: 'Discovery', icon: Search },
    { name: 'Scoring', icon: Target },
    { name: 'Customization', icon: FileText },
    { name: 'Strategy', icon: Zap },
  ]

  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto py-6">
      {stages.map((stage, idx) => {
        const Icon = stage.icon
        const isActive = idx === currentStage
        const isComplete = idx < currentStage
        return (
          <React.Fragment key={stage.name}>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                isComplete && 'bg-emerald-500 border-emerald-500 text-white',
                isActive && 'bg-indigo-500 border-indigo-500 text-white animate-pulse',
                !isComplete && !isActive && 'bg-slate-800 border-slate-600 text-slate-500'
              )}>
                {isComplete ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={cn(
                'text-xs font-medium',
                isComplete && 'text-emerald-400',
                isActive && 'text-indigo-400',
                !isComplete && !isActive && 'text-slate-500'
              )}>{stage.name}</span>
            </div>
            {idx < stages.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2 mt-[-1.5rem] transition-colors duration-500',
                idx < currentStage ? 'bg-emerald-500' : 'bg-slate-700'
              )} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: React.ElementType; accent?: string }) {
  return (
    <Card className="bg-slate-900/80 border-slate-700/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', accent || 'text-slate-100')}>{value || '--'}</p>
          </div>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', accent ? 'bg-indigo-500/10' : 'bg-slate-800')}>
            <Icon className={cn('h-5 w-5', accent || 'text-slate-400')} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingState({ lines }: { lines?: number }) {
  const count = lines ?? 4
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-4 bg-slate-800 rounded" style={{ width: `${85 - i * 10}%` }} />
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Page() {
  // ── Tab State ──
  const [activeTab, setActiveTab] = useState('dashboard')

  // ── Notifications ──
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notifIdRef = useRef(0)

  const addNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++notifIdRef.current
    setNotifications(prev => [...prev, { type, message, id }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }, [])

  const dismissNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // ── Sample Data Toggle ──
  const [showSample, setShowSample] = useState(false)

  // ── Active Agent ──
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // ── Pipeline State ──
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [pipelineStage, setPipelineStage] = useState(-1)
  const [pipelineError, setPipelineError] = useState<string | null>(null)

  // ── Profile Preferences ──
  const [profile, setProfile] = useState<ProfilePreferences>({
    targetRoles: '',
    skills: '',
    salaryMin: '',
    salaryMax: '',
    locations: '',
    workAuth: 'US Citizen'
  })

  // ── Knowledge Base ──
  const [documents, setDocuments] = useState<Array<{ fileName: string; fileType?: string; status?: string }>>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Application Queue ──
  const [appFilter, setAppFilter] = useState('all')
  const [appSort, setAppSort] = useState('score')
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({})

  // ── Interventions ──
  const [interventions, setInterventions] = useState<InterventionData[]>([])
  const [interventionLoading, setInterventionLoading] = useState(false)
  const [notificationEmail, setNotificationEmail] = useState('')
  const [resumingCompany, setResumingCompany] = useState<string | null>(null)

  // ── Analytics ──
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  // ── Schedules ──
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [selectedLogSchedule, setSelectedLogSchedule] = useState<string | null>(null)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Sample data effect ──
  useEffect(() => {
    if (showSample) {
      setPipelineData(SAMPLE_PIPELINE)
      setAnalyticsData(SAMPLE_ANALYTICS)
      setInterventions(SAMPLE_INTERVENTIONS)
      setPipelineStage(4)
      setProfile({
        targetRoles: 'Senior Frontend Engineer, Full Stack Developer, Staff Engineer',
        skills: 'React, TypeScript, Next.js, Node.js, GraphQL, System Design',
        salaryMin: '150000',
        salaryMax: '220000',
        locations: 'San Francisco, New York, Remote',
        workAuth: 'US Citizen'
      })
    } else {
      setPipelineData(null)
      setAnalyticsData(null)
      setInterventions([])
      setPipelineStage(-1)
      setProfile({ targetRoles: '', skills: '', salaryMin: '', salaryMax: '', locations: '', workAuth: 'US Citizen' })
    }
  }, [showSample])

  // ── Run Pipeline ──
  const runPipeline = useCallback(async () => {
    setPipelineLoading(true)
    setPipelineError(null)
    setPipelineStage(0)
    setActiveAgentId(PIPELINE_ORCHESTRATOR_ID)

    const message = `Run the full job discovery and application pipeline. User preferences: Target roles: ${profile.targetRoles || 'Software Engineer'}. Skills: ${profile.skills || 'JavaScript, React, TypeScript'}. Salary range: ${profile.salaryMin || '100000'}-${profile.salaryMax || '200000'}. Preferred locations: ${profile.locations || 'Remote'}. Work authorization: ${profile.workAuth || 'US Citizen'}. Search for relevant job openings, score them against my profile, customize my resume and cover letter for qualified matches, and determine the best application strategy for each.`

    // Simulate stage progression
    const stageTimer1 = setTimeout(() => setPipelineStage(1), 3000)
    const stageTimer2 = setTimeout(() => setPipelineStage(2), 6000)
    const stageTimer3 = setTimeout(() => setPipelineStage(3), 9000)

    try {
      const result = await callAIAgent(message, PIPELINE_ORCHESTRATOR_ID)
      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      clearTimeout(stageTimer3)

      const data = parseAgentResponse(result)
      if (data) {
        setPipelineData(data as PipelineData)
        setPipelineStage(4)
        addNotification('success', `Pipeline completed! ${data?.total_applications_prepared ?? '0'} applications prepared.`)
      } else {
        setPipelineError(result?.error || 'Failed to parse pipeline response')
        addNotification('error', 'Pipeline failed. Please try again.')
      }
    } catch (err) {
      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      clearTimeout(stageTimer3)
      setPipelineError(err instanceof Error ? err.message : 'Pipeline error')
      addNotification('error', 'Pipeline encountered an error.')
    } finally {
      setPipelineLoading(false)
      setActiveAgentId(null)
    }
  }, [profile, addNotification])

  // ── Knowledge Base ──
  const refreshDocuments = useCallback(async () => {
    setDocsLoading(true)
    try {
      const result = await getDocuments(RAG_ID)
      if (result.success && Array.isArray(result.documents)) {
        setDocuments(result.documents)
      }
    } catch {
      addNotification('error', 'Failed to load documents')
    } finally {
      setDocsLoading(false)
    }
  }, [addNotification])

  const handleCVUpload = useCallback(async (file: File) => {
    const validation = validateFile(file)
    if (!validation.valid) {
      addNotification('error', validation.error || 'Invalid file type')
      return
    }
    setUploadLoading(true)
    try {
      const result = await uploadAndTrainDocument(RAG_ID, file)
      if (result.success) {
        addNotification('success', 'CV uploaded and trained successfully')
        await refreshDocuments()
      } else {
        addNotification('error', result.error || 'Upload failed')
      }
    } catch {
      addNotification('error', 'Upload failed')
    } finally {
      setUploadLoading(false)
    }
  }, [addNotification, refreshDocuments])

  const handleDeleteDocument = useCallback(async (fileName: string) => {
    try {
      const result = await deleteDocuments(RAG_ID, [fileName])
      if (result.success) {
        addNotification('success', `Deleted "${fileName}"`)
        setDocuments(prev => prev.filter(d => d.fileName !== fileName))
      } else {
        addNotification('error', result.error || 'Delete failed')
      }
    } catch {
      addNotification('error', 'Delete failed')
    }
  }, [addNotification])

  // ── Interventions ──
  const checkInterventions = useCallback(async () => {
    setInterventionLoading(true)
    setActiveAgentId(HUMAN_INTERVENTION_ID)
    const checkMessage = `Check for any current intervention requirements in the job application pipeline. Report any CAPTCHAs, OTPs, login issues, or other blockers that need human attention. Send notification via Telegram immediately.${notificationEmail ? ` Also send backup notification to ${notificationEmail} via Gmail.` : ''}`
    try {
      const result = await callAIAgent(checkMessage, HUMAN_INTERVENTION_ID)
      const data = parseAgentResponse(result)
      if (data) {
        setInterventions(prev => [...prev, data as InterventionData])
        addNotification('info', 'Intervention check complete')
      } else {
        addNotification('info', 'No interventions detected or agent returned no data')
      }
    } catch {
      addNotification('error', 'Intervention check failed')
    } finally {
      setInterventionLoading(false)
      setActiveAgentId(null)
    }
  }, [notificationEmail, addNotification])

  const resumeIntervention = useCallback(async (company: string) => {
    setResumingCompany(company)
    setActiveAgentId(HUMAN_INTERVENTION_ID)
    const resumeMessage = `The user has resolved the intervention issue for ${company}. Resume the application process from the saved system state. Confirm via Telegram that the process has resumed.`
    try {
      const result = await callAIAgent(resumeMessage, HUMAN_INTERVENTION_ID)
      if (result.success) {
        setInterventions(prev => prev.filter(i => i.company !== company))
        addNotification('success', `Resumed application for ${company}`)
      } else {
        addNotification('error', `Failed to resume for ${company}`)
      }
    } catch {
      addNotification('error', 'Resume failed')
    } finally {
      setResumingCompany(null)
      setActiveAgentId(null)
    }
  }, [addNotification])

  // ── Analytics ──
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    setActiveAgentId(ANALYTICS_FEEDBACK_ID)
    const analyticsMessage = 'Generate a comprehensive analytics report for my job application pipeline. Include: total applications sent, interview conversion rate, top performing skills, scoring weight adjustments needed, weekly performance trends, and actionable recommendations for improving my application success rate.'
    try {
      const result = await callAIAgent(analyticsMessage, ANALYTICS_FEEDBACK_ID)
      const data = parseAgentResponse(result)
      if (data) {
        setAnalyticsData(data as AnalyticsData)
        addNotification('success', 'Analytics report generated')
      } else {
        setAnalyticsError('Failed to parse analytics data')
        addNotification('error', 'Analytics generation failed')
      }
    } catch {
      setAnalyticsError('Analytics request failed')
      addNotification('error', 'Analytics request failed')
    } finally {
      setAnalyticsLoading(false)
      setActiveAgentId(null)
    }
  }, [addNotification])

  // ── Schedules ──
  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true)
    try {
      const result = await listSchedules()
      if (result.success) {
        setSchedules(result.schedules)
      }
    } catch {
      addNotification('error', 'Failed to load schedules')
    } finally {
      setSchedulesLoading(false)
    }
  }, [addNotification])

  const handleToggleSchedule = useCallback(async (schedule: Schedule) => {
    setTogglingId(schedule.id)
    try {
      const result = schedule.is_active
        ? await pauseSchedule(schedule.id)
        : await resumeSchedule(schedule.id)
      if (result.success) {
        addNotification('success', `Schedule ${schedule.is_active ? 'paused' : 'activated'}`)
      } else {
        addNotification('error', `Failed to ${schedule.is_active ? 'pause' : 'activate'} schedule`)
      }
      await loadSchedules()
    } catch {
      addNotification('error', 'Schedule toggle failed')
    } finally {
      setTogglingId(null)
    }
  }, [addNotification, loadSchedules])

  const handleTriggerNow = useCallback(async (scheduleId: string) => {
    setTriggeringId(scheduleId)
    try {
      const result = await triggerScheduleNow(scheduleId)
      if (result.success) {
        addNotification('success', 'Schedule triggered successfully')
      } else {
        addNotification('error', 'Failed to trigger schedule')
      }
    } catch {
      addNotification('error', 'Trigger failed')
    } finally {
      setTriggeringId(null)
    }
  }, [addNotification])

  const loadLogs = useCallback(async (scheduleId: string) => {
    setSelectedLogSchedule(scheduleId)
    setLogsLoading(true)
    try {
      const result = await getScheduleLogs(scheduleId, { limit: 10 })
      if (result.success) {
        setExecutionLogs(result.executions)
      }
    } catch {
      addNotification('error', 'Failed to load logs')
    } finally {
      setLogsLoading(false)
    }
  }, [addNotification])

  // ── Load knowledge base docs on profile tab ──
  useEffect(() => {
    if (activeTab === 'profile') {
      refreshDocuments()
    }
  }, [activeTab, refreshDocuments])

  // ── Load schedules on schedule tab ──
  useEffect(() => {
    if (activeTab === 'schedules') {
      loadSchedules()
    }
  }, [activeTab, loadSchedules])

  // ── Application Queue filtering/sorting ──
  const applicationPackages = pipelineData?.application_packages
  const safePackages = Array.isArray(applicationPackages) ? applicationPackages : []

  const filteredApps = safePackages.filter((app) => {
    const status = localStatuses[`${app.company}-${app.job_title}`] || app.status || ''
    if (appFilter === 'all') return true
    if (appFilter === 'pending') return status.toLowerCase().includes('pending') || status.toLowerCase().includes('review')
    if (appFilter === 'auto') return status.toLowerCase().includes('auto')
    if (appFilter === 'approved') return status.toLowerCase().includes('approved')
    if (appFilter === 'skipped') return status.toLowerCase().includes('skip')
    return true
  })

  const sortedApps = [...filteredApps].sort((a, b) => {
    if (appSort === 'score') return (parseInt(b.score, 10) || 0) - (parseInt(a.score, 10) || 0)
    if (appSort === 'company') return (a.company ?? '').localeCompare(b.company ?? '')
    if (appSort === 'method') return (a.application_method ?? '').localeCompare(b.application_method ?? '')
    return 0
  })

  const handleApprove = (company: string, title: string) => {
    const key = `${company}-${title}`
    setLocalStatuses(prev => ({ ...prev, [key]: 'Approved' }))
    addNotification('success', `Approved: ${title} at ${company}`)
  }

  const handleSkip = (company: string, title: string) => {
    const key = `${company}-${title}`
    setLocalStatuses(prev => ({ ...prev, [key]: 'Skipped' }))
    addNotification('info', `Skipped: ${title} at ${company}`)
  }

  // ── Computed stats ──
  const totalApps = pipelineData?.total_applications_prepared ?? analyticsData?.total_applications ?? '--'
  const interviewRate = analyticsData?.interview_rate ?? '--'
  const activeJobs = pipelineData?.total_jobs_qualified ?? '--'
  const pendingReviews = pipelineData?.review_needed_count ?? '--'

  // ── Schedule name mapper ──
  const getScheduleName = (scheduleId: string, agentId: string) => {
    if (scheduleId === PIPELINE_SCHEDULE_ID || agentId === PIPELINE_ORCHESTRATOR_ID) return 'Job Pipeline (Daily)'
    if (scheduleId === ANALYTICS_SCHEDULE_ID || agentId === ANALYTICS_FEEDBACK_ID) return 'Analytics Report (Weekly)'
    return `Schedule ${scheduleId.slice(0, 8)}`
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />

        {/* ─── Sidebar + Main Layout ─── */}
        <div className="flex min-h-screen">
          {/* ─── Sidebar ─── */}
          <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900/80 border-r border-slate-800 p-4">
            <div className="flex items-center gap-3 mb-8 px-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">JobPilot AI</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Telegram-Powered Automation</p>
              </div>
            </div>

            <nav className="space-y-1 flex-1">
              {[
                { key: 'dashboard', label: 'Dashboard', icon: Home },
                { key: 'profile', label: 'Profile & CV', icon: User },
                { key: 'queue', label: 'Application Queue', icon: Briefcase },
                { key: 'interventions', label: 'Alerts', icon: Bell },
                { key: 'analytics', label: 'Analytics', icon: BarChart3 },
                { key: 'schedules', label: 'Schedules', icon: Calendar },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    activeTab === key
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {key === 'interventions' && interventions.length > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">{interventions.length}</span>
                  )}
                </button>
              ))}
            </nav>

            <Separator className="my-4 bg-slate-800" />

            {/* Sample Data Toggle */}
            <div className="px-2 py-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">Sample Data</Label>
                <Switch checked={showSample} onCheckedChange={setShowSample} />
              </div>
            </div>

            {/* Agent Status */}
            <div className="mt-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest px-2 mb-2">Agents</p>
              <ScrollArea className="h-40">
                <div className="space-y-1 pr-2">
                  {AGENTS.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs">
                      <div className={cn('w-1.5 h-1.5 rounded-full', activeAgentId === agent.id ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
                      <span className={cn('truncate', activeAgentId === agent.id ? 'text-emerald-400' : 'text-slate-500')}>{agent.name}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </aside>

          {/* ─── Mobile Nav ─── */}
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-800">
            <div className="flex items-center justify-around py-2">
              {[
                { key: 'dashboard', icon: Home },
                { key: 'profile', icon: User },
                { key: 'queue', icon: Briefcase },
                { key: 'interventions', icon: Bell },
                { key: 'analytics', icon: BarChart3 },
                { key: 'schedules', icon: Calendar },
              ].map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'p-2 rounded-lg transition-colors relative',
                    activeTab === key ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {key === 'interventions' && interventions.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center">{interventions.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Main Content ─── */}
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
            {/* ─── Header ─── */}
            <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="lg:hidden flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                    <Briefcase className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-bold text-white">JobPilot AI</span>
                </div>
                <h2 className="text-lg font-semibold text-white hidden lg:block">
                  {activeTab === 'dashboard' && 'Dashboard'}
                  {activeTab === 'profile' && 'Profile & Knowledge Base'}
                  {activeTab === 'queue' && 'Application Queue'}
                  {activeTab === 'interventions' && 'Intervention Alerts'}
                  {activeTab === 'analytics' && 'Analytics'}
                  {activeTab === 'schedules' && 'Schedule Management'}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="lg:hidden flex items-center gap-2">
                    <Label className="text-xs text-slate-400">Sample</Label>
                    <Switch checked={showSample} onCheckedChange={setShowSample} />
                  </div>
                  {activeAgentId && (
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-xs">
                      <Activity className="h-3 w-3 mr-1 animate-pulse" />
                      Agent Active
                    </Badge>
                  )}
                </div>
              </div>
            </header>

            <div className="px-6 py-6 max-w-7xl mx-auto">

              {/* ════════════════════════════════════════════════════════════════
                   TAB 1: DASHBOARD
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Hero */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600/20 via-blue-600/10 to-slate-900 border border-indigo-500/20 p-8">
                    <div className="relative z-10">
                      <h1 className="text-3xl font-bold text-white mb-2">Welcome to JobPilot AI</h1>
                      <p className="text-slate-300 max-w-xl mb-4">Your intelligent job application pipeline. Discover, score, customize, and apply to jobs automatically -- powered by AI agents working in concert.</p>
                      <div className="flex items-center gap-3 mb-6 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 max-w-xl">
                        <MessageCircle className="h-5 w-5 text-blue-400 shrink-0" />
                        <div>
                          <p className="text-sm text-blue-200 font-medium">Telegram is your command center</p>
                          <p className="text-xs text-blue-300/70 mt-0.5">Send commands via Telegram to trigger pipelines, set preferences, and manage applications. This dashboard monitors results.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          size="lg"
                          onClick={runPipeline}
                          disabled={pipelineLoading}
                          variant="outline"
                          className="border-slate-600 text-slate-200 hover:bg-slate-800"
                        >
                          {pipelineLoading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running Pipeline...</>
                          ) : (
                            <><Play className="h-4 w-4 mr-2" />Run Pipeline (Dashboard)</>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
                  </div>

                  {/* Telegram Commands Reference */}
                  <Card className="bg-slate-900/80 border-slate-700/50 border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                        <Bot className="h-5 w-5 text-blue-400" />
                        Telegram Commands
                      </CardTitle>
                      <CardDescription className="text-slate-400">Send these commands to your JobPilot Telegram bot to control the pipeline</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { cmd: '/run', desc: 'Trigger the full job discovery and application pipeline' },
                          { cmd: '/status', desc: 'Check current pipeline status and recent results' },
                          { cmd: '/resume [company]', desc: 'Resume a paused application after resolving an issue' },
                          { cmd: '/analytics', desc: 'Generate a fresh analytics and performance report' },
                          { cmd: '/preferences', desc: 'Update your target roles, skills, salary, and location' },
                          { cmd: '/help', desc: 'View all available commands and bot instructions' },
                        ].map(({ cmd, desc }) => (
                          <div key={cmd} className="flex items-start gap-3 bg-slate-800/40 rounded-lg px-3 py-2.5 border border-slate-700/30">
                            <code className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded shrink-0 mt-0.5">{cmd}</code>
                            <p className="text-xs text-slate-400">{desc}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Applications" value={String(totalApps)} icon={Send} accent="text-indigo-400" />
                    <StatCard label="Interview Rate" value={String(interviewRate)} icon={TrendingUp} accent="text-emerald-400" />
                    <StatCard label="Active Jobs" value={String(activeJobs)} icon={Briefcase} accent="text-blue-400" />
                    <StatCard label="Pending Review" value={String(pendingReviews)} icon={Eye} accent="text-amber-400" />
                  </div>

                  {/* Pipeline Progress */}
                  {pipelineLoading && (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                      <CardHeader>
                        <CardTitle className="text-base text-slate-200">Pipeline Progress</CardTitle>
                        <CardDescription className="text-slate-400">AI agents are processing your job pipeline...</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PipelineStages currentStage={pipelineStage} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Pipeline Error */}
                  {pipelineError && (
                    <Card className="bg-red-950/30 border-red-700/30">
                      <CardContent className="p-4 flex items-center gap-3">
                        <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-red-300">{pipelineError}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={runPipeline} className="border-red-700 text-red-300 hover:bg-red-950">
                          <RefreshCw className="h-3 w-3 mr-1" />Retry
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Pipeline Results */}
                  {pipelineData && !pipelineLoading && (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-emerald-400" />
                              Pipeline Results
                            </CardTitle>
                            <CardDescription className="text-slate-400 mt-1">
                              Status: {pipelineData.pipeline_status ?? 'Complete'}
                            </CardDescription>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setActiveTab('queue')} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                            View Queue <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {[
                            { label: 'Discovered', value: pipelineData.total_jobs_discovered },
                            { label: 'Qualified', value: pipelineData.total_jobs_qualified },
                            { label: 'Prepared', value: pipelineData.total_applications_prepared },
                            { label: 'Auto-Applied', value: pipelineData.auto_apply_count },
                            { label: 'Needs Review', value: pipelineData.review_needed_count },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-slate-800/50 rounded-lg p-3 text-center">
                              <p className="text-xl font-bold text-white">{value ?? '--'}</p>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{label}</p>
                            </div>
                          ))}
                        </div>
                        {pipelineData.pipeline_summary && (
                          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Summary</p>
                            <div className="text-sm text-slate-300">{renderMarkdown(pipelineData.pipeline_summary)}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Empty State */}
                  {!pipelineData && !pipelineLoading && !pipelineError && (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                      <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                          <MessageCircle className="h-8 w-8 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">No pipeline results yet</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">Send <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-xs font-mono">/run</code> via Telegram to trigger the pipeline, or use the dashboard button above. Results will appear here.</p>
                        <p className="text-xs text-slate-600">Tip: Upload your CV in the Profile tab and set preferences before running.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                   TAB 2: PROFILE & KNOWLEDGE BASE
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  {/* Telegram Connection Info */}
                  <Card className="bg-slate-900/80 border-slate-700/50 border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-blue-400" />
                        Telegram Integration
                      </CardTitle>
                      <CardDescription className="text-slate-400">Your primary input channel for controlling JobPilot AI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Smartphone className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                            <div className="space-y-2">
                              <p className="text-sm text-slate-300">All user inputs -- job preferences, pipeline triggers, intervention responses -- are handled via Telegram.</p>
                              <p className="text-sm text-slate-300">This dashboard serves as a <strong className="text-white">monitoring and review interface</strong>. You can still upload CVs and review applications here.</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30 text-center">
                            <Hash className="h-5 w-5 text-blue-400 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">Send preferences</p>
                            <code className="text-[10px] text-blue-400 font-mono">/preferences</code>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30 text-center">
                            <Play className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">Trigger pipeline</p>
                            <code className="text-[10px] text-blue-400 font-mono">/run</code>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30 text-center">
                            <Bell className="h-5 w-5 text-amber-400 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">Get alerts</p>
                            <code className="text-[10px] text-blue-400 font-mono">Auto via bot</code>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CV Upload */}
                  <Card className="bg-slate-900/80 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                        <Upload className="h-5 w-5 text-indigo-400" />
                        Upload Your CV
                      </CardTitle>
                      <CardDescription className="text-slate-400">Upload your resume/CV to the knowledge base. Supported formats: PDF, DOCX, TXT</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleCVUpload(file)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                      />
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
                      >
                        {uploadLoading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                            <p className="text-sm text-slate-400">Uploading and training...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-slate-500" />
                            <p className="text-sm text-slate-400">Click to upload or drag and drop</p>
                            <p className="text-xs text-slate-600">PDF, DOCX, or TXT up to 10MB</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Uploaded Documents */}
                  <Card className="bg-slate-900/80 border-slate-700/50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                          <FileText className="h-5 w-5 text-indigo-400" />
                          Uploaded Documents
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={refreshDocuments} disabled={docsLoading} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                          {docsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          <span className="ml-1.5">Refresh</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {docsLoading && documents.length === 0 ? (
                        <LoadingState lines={3} />
                      ) : documents.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No documents uploaded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {documents.map((doc) => (
                            <div key={doc.fileName} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/30">
                              <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-indigo-400" />
                                <div>
                                  <p className="text-sm text-slate-200">{doc.fileName}</p>
                                  <p className="text-xs text-slate-500">{doc.fileType ?? 'document'} {doc.status ? `- ${doc.status}` : ''}</p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.fileName)}
                                className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Profile Preferences */}
                  <Card className="bg-slate-900/80 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                        <Settings className="h-5 w-5 text-indigo-400" />
                        Profile Preferences
                      </CardTitle>
                      <CardDescription className="text-slate-400">Reference view of your job search preferences. Update these via Telegram using <code className="text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded text-[10px] font-mono">/preferences</code> or edit locally below.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="text-slate-300 text-sm flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-indigo-400" />Target Roles</Label>
                          <Input
                            placeholder="e.g., Senior Frontend Engineer, Full Stack Developer"
                            value={profile.targetRoles}
                            onChange={(e) => setProfile(prev => ({ ...prev, targetRoles: e.target.value }))}
                            className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300 text-sm flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-indigo-400" />Skills (comma-separated)</Label>
                          <Input
                            placeholder="e.g., React, TypeScript, Node.js, GraphQL"
                            value={profile.skills}
                            onChange={(e) => setProfile(prev => ({ ...prev, skills: e.target.value }))}
                            className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300 text-sm flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-indigo-400" />Salary Range</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Min (e.g., 150000)"
                              value={profile.salaryMin}
                              onChange={(e) => setProfile(prev => ({ ...prev, salaryMin: e.target.value }))}
                              className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600"
                            />
                            <span className="text-slate-500">to</span>
                            <Input
                              type="number"
                              placeholder="Max (e.g., 220000)"
                              value={profile.salaryMax}
                              onChange={(e) => setProfile(prev => ({ ...prev, salaryMax: e.target.value }))}
                              className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300 text-sm flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-indigo-400" />Preferred Locations</Label>
                          <Input
                            placeholder="e.g., San Francisco, New York, Remote"
                            value={profile.locations}
                            onChange={(e) => setProfile(prev => ({ ...prev, locations: e.target.value }))}
                            className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600"
                          />
                        </div>
                      </div>
                      <div className="space-y-2 max-w-sm">
                        <Label className="text-slate-300 text-sm flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-indigo-400" />Work Authorization</Label>
                        <Select value={profile.workAuth} onValueChange={(val) => setProfile(prev => ({ ...prev, workAuth: val }))}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="US Citizen">US Citizen</SelectItem>
                            <SelectItem value="Green Card">Green Card</SelectItem>
                            <SelectItem value="H1B">H1B Visa</SelectItem>
                            <SelectItem value="OPT/CPT">OPT/CPT</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                    <CardFooter className="border-t border-slate-800 pt-4">
                      <p className="text-xs text-slate-500">Preferences are stored locally for dashboard pipeline runs. For Telegram-triggered runs, update via <code className="text-blue-400 font-mono">/preferences</code> command.</p>
                    </CardFooter>
                  </Card>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                   TAB 3: APPLICATION QUEUE
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'queue' && (
                <div className="space-y-6">
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-500" />
                      <Select value={appFilter} onValueChange={setAppFilter}>
                        <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700 text-slate-200 h-9">
                          <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="all">All Applications</SelectItem>
                          <SelectItem value="pending">Pending Review</SelectItem>
                          <SelectItem value="auto">Auto-Applied</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="skipped">Skipped</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <SortAsc className="h-4 w-4 text-slate-500" />
                      <Select value={appSort} onValueChange={setAppSort}>
                        <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700 text-slate-200 h-9">
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="score">Score (High to Low)</SelectItem>
                          <SelectItem value="company">Company Name</SelectItem>
                          <SelectItem value="method">Apply Method</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-slate-500 sm:ml-auto">{sortedApps.length} application(s)</p>
                  </div>

                  {/* Application Cards */}
                  {sortedApps.length === 0 ? (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                      <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                          <Briefcase className="h-8 w-8 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">No applications in queue</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">Send <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-xs font-mono">/run</code> via Telegram or trigger the pipeline from the Dashboard to discover and prepare applications.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sortedApps.map((app, idx) => {
                        const key = `${app.company}-${app.job_title}`
                        const currentStatus = localStatuses[key] || app.status || 'Unknown'
                        const scoreNum = parseInt(app.score, 10) || 0
                        const isPending = currentStatus.toLowerCase().includes('pending') || currentStatus.toLowerCase().includes('review')

                        return (
                          <Card key={`${key}-${idx}`} className="bg-slate-900/80 border-slate-700/50 hover:border-slate-600/50 transition-colors">
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-semibold text-white truncate">{app.job_title ?? 'Untitled'}</h3>
                                  <p className="text-xs text-slate-400 mt-0.5">{app.company ?? 'Unknown'}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className={cn('text-lg font-bold', getScoreTextColor(app.score))}>{app.score ?? '--'}</span>
                                </div>
                              </div>

                              <Progress value={scoreNum} className={cn('h-1.5 mb-3')} />

                              <div className="flex flex-wrap gap-1.5 mb-3">
                                <Badge variant={getStatusBadgeVariant(currentStatus)} className="text-[10px]">{currentStatus}</Badge>
                                {app.application_method && (
                                  <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">{app.application_method}</Badge>
                                )}
                                {app.resume_customized?.toLowerCase() === 'yes' && (
                                  <Badge variant="outline" className="text-[10px] border-emerald-700/40 text-emerald-400">Resume Ready</Badge>
                                )}
                                {app.cover_letter_ready?.toLowerCase() === 'yes' && (
                                  <Badge variant="outline" className="text-[10px] border-emerald-700/40 text-emerald-400">Cover Letter Ready</Badge>
                                )}
                              </div>

                              {isPending && (
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                                  <Button size="sm" onClick={() => handleApprove(app.company, app.job_title)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" />Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleSkip(app.company, app.job_title)} className="flex-1 border-slate-600 text-slate-400 hover:bg-slate-800 h-8 text-xs">
                                    <SkipForward className="h-3 w-3 mr-1" />Skip
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                   TAB 4: INTERVENTION ALERTS
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'interventions' && (
                <div className="space-y-6">
                  {/* Telegram Alert Info */}
                  <Card className="bg-slate-900/80 border-slate-700/50 border-l-4 border-l-blue-500">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <MessageCircle className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-blue-200 font-medium">Alerts are sent via Telegram</p>
                          <p className="text-xs text-blue-300/70 mt-1">When CAPTCHAs, OTPs, or login issues are detected, you will receive an instant Telegram notification. Resolve the issue and reply with <code className="text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded font-mono">/resume [company]</code> to continue. Gmail backup notifications are also sent.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notification Email + Check */}
                  <Card className="bg-slate-900/80 border-slate-700/50">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                        <div className="flex-1 space-y-2">
                          <Label className="text-slate-300 text-sm flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-indigo-400" />
                            Backup Notification Email
                          </Label>
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            value={notificationEmail}
                            onChange={(e) => setNotificationEmail(e.target.value)}
                            className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 max-w-sm"
                          />
                          <p className="text-[10px] text-slate-500">Primary: Telegram | Backup: Gmail</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={checkInterventions}
                            disabled={interventionLoading}
                            className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white border-0"
                          >
                            {interventionLoading ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking...</>
                            ) : (
                              <><Bell className="h-4 w-4 mr-2" />Check Alerts</>
                            )}
                          </Button>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" onClick={checkInterventions} disabled={interventionLoading} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                  <AlertTriangle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-800 border-slate-700 text-slate-200">
                                <p>Test Alert: Simulate an intervention check</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Alerts List */}
                  {interventions.length === 0 ? (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                      <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">No active alerts</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">All clear. No CAPTCHAs, OTPs, or login issues detected. Alerts are sent to your Telegram automatically. Click "Check Alerts" to scan manually.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {interventions.map((alert, idx) => (
                        <Card key={idx} className="bg-slate-900/80 border-slate-700/50 border-l-4 border-l-amber-500">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                                <div>
                                  <h3 className="text-sm font-semibold text-white">{alert.intervention_type ?? 'Unknown Intervention'}</h3>
                                  <p className="text-xs text-slate-400">{alert.affected_application ?? ''} at {alert.company ?? 'Unknown'}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="border-amber-600/40 text-amber-400 text-[10px]">
                                {alert.system_state?.toLowerCase()?.includes('paused') ? 'Paused' : 'Active'}
                              </Badge>
                            </div>

                            <div className="space-y-2 mb-4">
                              {alert.description && (
                                <div className="bg-slate-800/50 rounded p-3">
                                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Description</p>
                                  <p className="text-sm text-slate-300">{alert.description}</p>
                                </div>
                              )}
                              {alert.action_required && (
                                <div className="bg-amber-950/20 rounded p-3 border border-amber-700/20">
                                  <p className="text-xs text-amber-500 uppercase tracking-wider mb-1">Action Required</p>
                                  <p className="text-sm text-amber-200">{alert.action_required}</p>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                                {alert.system_state && <span>State: {alert.system_state}</span>}
                                {alert.telegram_sent && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-blue-400" />Telegram: {alert.telegram_sent}</span>}
                                {alert.notification_sent && <span>Notification: {alert.notification_sent} via {alert.notification_method ?? 'N/A'}</span>}
                                {alert.timestamp && <span>Time: {alert.timestamp}</span>}
                              </div>
                            </div>

                            <Button
                              size="sm"
                              onClick={() => resumeIntervention(alert.company)}
                              disabled={resumingCompany === alert.company}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              {resumingCompany === alert.company ? (
                                <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Resuming...</>
                              ) : (
                                <><Play className="h-3 w-3 mr-1.5" />Resume Application</>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                   TAB 5: ANALYTICS
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {/* Header Actions */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">Performance insights and recommendations for your job search.</p>
                    <Button
                      onClick={loadAnalytics}
                      disabled={analyticsLoading}
                      className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white border-0"
                    >
                      {analyticsLoading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" />Refresh Analytics</>
                      )}
                    </Button>
                  </div>

                  {analyticsError && (
                    <Card className="bg-red-950/30 border-red-700/30">
                      <CardContent className="p-4 flex items-center gap-3">
                        <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                        <p className="text-sm text-red-300 flex-1">{analyticsError}</p>
                        <Button variant="outline" size="sm" onClick={loadAnalytics} className="border-red-700 text-red-300 hover:bg-red-950">
                          <RefreshCw className="h-3 w-3 mr-1" />Retry
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {analyticsLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="bg-slate-900/80 border-slate-700/50">
                          <CardContent className="p-5">
                            <Skeleton className="h-3 w-20 bg-slate-800 mb-3" />
                            <Skeleton className="h-8 w-24 bg-slate-800 mb-2" />
                            <Skeleton className="h-3 w-32 bg-slate-800" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {analyticsData && !analyticsLoading && (
                    <>
                      {/* Key Metrics */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard label="Total Applications" value={analyticsData.total_applications ?? '--'} icon={Send} accent="text-indigo-400" />
                        <StatCard label="Interview Rate" value={analyticsData.interview_rate ?? '--'} icon={TrendingUp} accent="text-emerald-400" />
                        <StatCard label="Top Skills" value={analyticsData.top_performing_skills?.split(',')[0]?.trim() ?? '--'} icon={Star} accent="text-amber-400" />
                      </div>

                      {/* Top Skills Full */}
                      {analyticsData.top_performing_skills && (
                        <Card className="bg-slate-900/80 border-slate-700/50">
                          <CardHeader>
                            <CardTitle className="text-base text-slate-200">Top Performing Skills</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2">
                              {analyticsData.top_performing_skills.split(',').map((skill, i) => (
                                <Badge key={i} variant="secondary" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                                  {skill.trim()}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Application Trends */}
                      {Array.isArray(analyticsData.application_trends) && analyticsData.application_trends.length > 0 && (
                        <Card className="bg-slate-900/80 border-slate-700/50">
                          <CardHeader>
                            <CardTitle className="text-base text-slate-200">Application Trends</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {analyticsData.application_trends.map((trend, idx) => {
                                const sent = parseInt(trend.applications_sent, 10) || 0
                                const received = parseInt(trend.interviews_received, 10) || 0
                                const maxSent = Math.max(...analyticsData.application_trends.map(t => parseInt(t.applications_sent, 10) || 0), 1)
                                return (
                                  <div key={idx} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-400">{trend.week ?? `Week ${idx + 1}`}</span>
                                      <span className="text-slate-500">{sent} sent / {received} interviews ({trend.conversion_rate ?? 'N/A'})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-5 bg-slate-800 rounded-md overflow-hidden relative">
                                        <div className="h-full bg-indigo-500/60 rounded-md transition-all" style={{ width: `${(sent / maxSent) * 100}%` }} />
                                        <div className="absolute inset-0 h-full bg-emerald-500/70 rounded-md transition-all" style={{ width: `${(received / maxSent) * 100}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                              <div className="flex items-center gap-4 text-[10px] text-slate-500 mt-2">
                                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-indigo-500/60 rounded" /> Applications</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/70 rounded" /> Interviews</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Recommendations */}
                      {Array.isArray(analyticsData.recommendations) && analyticsData.recommendations.length > 0 && (
                        <Card className="bg-slate-900/80 border-slate-700/50">
                          <CardHeader>
                            <CardTitle className="text-base text-slate-200">Recommendations</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-slate-800 hover:bg-transparent">
                                  <TableHead className="text-slate-400 text-xs">Category</TableHead>
                                  <TableHead className="text-slate-400 text-xs">Suggestion</TableHead>
                                  <TableHead className="text-slate-400 text-xs">Impact</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {analyticsData.recommendations.map((rec, idx) => (
                                  <TableRow key={idx} className="border-slate-800">
                                    <TableCell className="text-sm text-slate-300 font-medium">{rec.category ?? '--'}</TableCell>
                                    <TableCell className="text-sm text-slate-400">{rec.suggestion ?? '--'}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={cn(
                                        'text-[10px]',
                                        (rec.impact ?? '').toLowerCase() === 'high' && 'border-emerald-600/40 text-emerald-400',
                                        (rec.impact ?? '').toLowerCase() === 'medium' && 'border-amber-600/40 text-amber-400',
                                        (rec.impact ?? '').toLowerCase() === 'low' && 'border-slate-600/40 text-slate-400'
                                      )}>
                                        {rec.impact ?? '--'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      )}

                      {/* Scoring Adjustments */}
                      {analyticsData.scoring_adjustments && (
                        <Card className="bg-slate-900/80 border-slate-700/50">
                          <CardHeader>
                            <CardTitle className="text-base text-slate-200">Scoring Adjustments</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm text-slate-300">{renderMarkdown(analyticsData.scoring_adjustments)}</div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Weekly Summary */}
                      {analyticsData.weekly_summary && (
                        <Card className="bg-slate-900/80 border-slate-700/50">
                          <CardHeader>
                            <CardTitle className="text-base text-slate-200">Weekly Summary</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm text-slate-300">{renderMarkdown(analyticsData.weekly_summary)}</div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}

                  {/* Empty State */}
                  {!analyticsData && !analyticsLoading && !analyticsError && (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                      <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                          <BarChart3 className="h-8 w-8 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">No analytics data yet</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">Click "Refresh Analytics" to generate a comprehensive performance report from the Analytics agent.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                   TAB 6: SCHEDULE MANAGEMENT
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'schedules' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">Manage automated schedules for your pipeline and analytics agents.</p>
                    <Button variant="outline" onClick={loadSchedules} disabled={schedulesLoading} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      {schedulesLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Refresh
                    </Button>
                  </div>

                  {schedulesLoading && schedules.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <Card key={i} className="bg-slate-900/80 border-slate-700/50">
                          <CardContent className="p-5">
                            <Skeleton className="h-5 w-40 bg-slate-800 mb-3" />
                            <Skeleton className="h-3 w-56 bg-slate-800 mb-2" />
                            <Skeleton className="h-3 w-32 bg-slate-800" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : schedules.length === 0 ? (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                      <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                          <Calendar className="h-8 w-8 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">No schedules found</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">Schedules will appear here once configured. Click Refresh to reload.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {schedules.map((schedule) => (
                        <Card key={schedule.id} className={cn(
                          'bg-slate-900/80 border-slate-700/50',
                          schedule.is_active && 'border-l-4 border-l-emerald-500'
                        )}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base text-slate-200">
                                {getScheduleName(schedule.id, schedule.agent_id)}
                              </CardTitle>
                              <Badge variant={schedule.is_active ? 'default' : 'secondary'} className={cn(
                                'text-[10px]',
                                schedule.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400'
                              )}>
                                {schedule.is_active ? 'Active' : 'Paused'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-slate-400">
                                <Clock className="h-3.5 w-3.5 text-slate-500" />
                                <span>{schedule.cron_expression ? cronToHuman(schedule.cron_expression) : 'No schedule'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-400">
                                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                                <span>Cron: {schedule.cron_expression ?? 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-400">
                                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                                <span>Timezone: {schedule.timezone ?? 'UTC'}</span>
                              </div>
                              {schedule.next_run_time && (
                                <div className="flex items-center gap-2 text-slate-400">
                                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Next run: {schedule.next_run_time}</span>
                                </div>
                              )}
                              {schedule.last_run_at && (
                                <div className="flex items-center gap-2 text-slate-400">
                                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Last run: {schedule.last_run_at} {schedule.last_run_success === true ? '(Success)' : schedule.last_run_success === false ? '(Failed)' : ''}</span>
                                </div>
                              )}
                            </div>

                            <Separator className="bg-slate-800" />

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <Switch
                                  checked={schedule.is_active}
                                  onCheckedChange={() => handleToggleSchedule(schedule)}
                                  disabled={togglingId === schedule.id}
                                />
                                <Label className="text-xs text-slate-400">
                                  {togglingId === schedule.id ? 'Toggling...' : (schedule.is_active ? 'Active' : 'Activate')}
                                </Label>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTriggerNow(schedule.id)}
                                disabled={triggeringId === schedule.id}
                                className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs"
                              >
                                {triggeringId === schedule.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Play className="h-3 w-3 mr-1" />
                                )}
                                Run Now
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadLogs(schedule.id)}
                                className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Logs
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Execution Logs */}
                  {selectedLogSchedule && (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base text-slate-200">Execution Logs</CardTitle>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedLogSchedule(null); setExecutionLogs([]) }} className="text-slate-500 hover:text-slate-300">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardDescription className="text-slate-400">Recent executions for schedule {selectedLogSchedule.slice(0, 8)}...</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {logsLoading ? (
                          <LoadingState lines={5} />
                        ) : executionLogs.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">No execution logs found.</p>
                        ) : (
                          <div className="space-y-2">
                            {executionLogs.map((log) => (
                              <div key={log.id} className={cn(
                                'flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-3 border',
                                log.success ? 'border-emerald-700/20' : 'border-red-700/20'
                              )}>
                                {log.success ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-300 truncate">
                                    Attempt {log.attempt ?? 1}/{log.max_attempts ?? 3} -- Status {log.response_status ?? 'N/A'}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">{log.executed_at ?? ''}</p>
                                  {log.error_message && <p className="text-xs text-red-400 mt-1 truncate">{log.error_message}</p>}
                                </div>
                                <Badge variant={log.success ? 'default' : 'destructive'} className="text-[10px]">
                                  {log.success ? 'Success' : 'Failed'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
