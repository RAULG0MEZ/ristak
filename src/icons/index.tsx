import {
  LayoutDashboard,
  CreditCard,
  ArrowUpDown,
  ArrowRight,
  ArrowDown,
  History,
  Settings,
  Bell,
  Search,
  Moon,
  Sun,
  Send,
  FileText,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertCircle,
  Info,
  Home,
  Plus,
  Minus,
  DollarSign,
  Users,
  User,
  ShoppingCart,
  Package,
  Activity,
  Clock,
  Download,
  Target,
  MousePointer,
  Folder,
  Image,
  Eye,
  XCircle,
  RefreshCw,
  Webhook,
  Code,
  Shield,
  Database,
  Globe,
  Zap,
  Facebook,
  Chrome,
  Copy,
  Upload,
  UserPlus,
  Edit,
  Trash2,
  CheckCircle,
  Save,
  Megaphone,
  BarChart3,
  FileBarChart,
  ScrollText,
  Star,
  Trophy,
  GripVertical,
  Play,
  Phone,
  Building,
  Receipt
} from 'lucide-react'
import { Meta } from '@lobehub/icons'
import { useEffect, useState } from 'react'

// Custom Meta icon component that respects theme
const MetaIcon = ({ className }: { className?: string }) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setIsDarkMode(isDark)
    }
    
    checkTheme()
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [])
  
  // Extract size from className (e.g., "w-4 h-4" -> 16)
  const sizeMatch = className?.match(/w-(\d+)/)
  const size = sizeMatch ? parseInt(sizeMatch[1]) * 4 : 24
  
  // Use icon only (no text/brand name)
  // Dark mode: white icon | Light mode: colored icon
  return isDarkMode ? (
    <Meta size={size} className={className} />
  ) : (
    <Meta.Color size={size} className={className} />
  )
}

export const Icons = {
  dashboard: LayoutDashboard,
  card: CreditCard,
  transactions: ArrowUpDown,
  arrowUpDown: ArrowUpDown,
  arrowRight: ArrowRight,
  arrowDown: ArrowDown,
  history: History,
  settings: Settings,
  notification: Bell,
  bell: Bell,
  search: Search,
  moon: Moon,
  sun: Sun,
  send: Send,
  fileText: FileText,
  request: FileText,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  more: MoreVertical,
  filter: Filter,
  calendar: Calendar,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  x: X,
  close: X,
  check: Check,
  alertCircle: AlertCircle,
  alert: AlertCircle,
  info: Info,
  home: Home,
  plus: Plus,
  minus: Minus,
  dollarSign: DollarSign,
  dollar: DollarSign,
  users: Users,
  user: User,
  shoppingCart: ShoppingCart,
  cart: ShoppingCart,
  package: Package,
  activity: Activity,
  clock: Clock,
  download: Download,
  target: Target,
  mousePointer: MousePointer,
  folder: Folder,
  image: Image,
  eye: Eye,
  checkCircle: CheckCircle,
  xCircle: XCircle,
  refresh: RefreshCw,
  webhook: Webhook,
  code: Code,
  shield: Shield,
  database: Database,
  globe: Globe,
  zap: Zap,
  facebook: Facebook,
  meta: MetaIcon,
  google: Chrome,
  copy: Copy,
  upload: Upload,
  userPlus: UserPlus,
  edit: Edit,
  trash2: Trash2,
  save: Save,
  megaphone: Megaphone,
  barChart: BarChart3,
  fileBarChart: FileBarChart,
  scrollText: ScrollText,
  logs: ScrollText,
  campaigns: Megaphone,
  reports: BarChart3,
  star: Star,
  trophy: Trophy,
  grip: GripVertical,
  play: Play,
  rocket: Zap,
  phone: Phone,
  building: Building,
  receipt: Receipt,
}

export type IconName = keyof typeof Icons