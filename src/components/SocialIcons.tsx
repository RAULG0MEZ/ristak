import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

// Importar SVGs NEGROS para light mode - TODOS los disponibles
import FacebookBlackPath from '../theme/social-icons-master/SVG/Black/Facebook_black.svg'
import InstagramBlackPath from '../theme/social-icons-master/SVG/Black/Instagram_black.svg'
import GoogleBlackPath from '../theme/social-icons-master/SVG/Black/Google_black.svg'
import TwitterBlackPath from '../theme/social-icons-master/SVG/Black/Twitter_black.svg'
import TikTokBlackPath from '../theme/social-icons-master/SVG/Black/Tik Tok_black.svg'
import YoutubeBlackPath from '../theme/social-icons-master/SVG/Black/Youtube_black.svg'
import PinterestBlackPath from '../theme/social-icons-master/SVG/Black/Pinterest_black.svg'
import SnapchatBlackPath from '../theme/social-icons-master/SVG/Black/Snapchat_black.svg'
import RedditBlackPath from '../theme/social-icons-master/SVG/Black/Reddit_black.svg'
import WhatsAppBlackPath from '../theme/social-icons-master/SVG/Black/WhatsApp_black.svg'
import TelegramBlackPath from '../theme/social-icons-master/SVG/Black/Telegram_black.svg'
import SafariBlackPath from '../theme/social-icons-master/SVG/Black/Safari_black.svg'
import FirefoxBlackPath from '../theme/social-icons-master/SVG/Black/Firefox_black.svg'
import EdgeBlackPath from '../theme/social-icons-master/SVG/Black/Edge_black.svg'
import OperaBlackPath from '../theme/social-icons-master/SVG/Black/Opera_black.svg'
import AndroidBlackPath from '../theme/social-icons-master/SVG/Black/Android_black.svg'
import AppleBlackPath from '../theme/social-icons-master/SVG/Black/Apple_black.svg'
import WindowsBlackPath from '../theme/social-icons-master/SVG/Black/Windows_black.svg'
import UbuntuBlackPath from '../theme/social-icons-master/SVG/Black/Ubuntu_black.svg'

// Importar SVGs BLANCOS para dark mode - TODOS los disponibles
import FacebookWhitePath from '../theme/social-icons-master/SVG/White/Facebook_white.svg'
import InstagramWhitePath from '../theme/social-icons-master/SVG/White/Instagram_white.svg'
import GoogleWhitePath from '../theme/social-icons-master/SVG/White/Google_white.svg'
import TwitterWhitePath from '../theme/social-icons-master/SVG/White/Twitter_white.svg'
import TikTokWhitePath from '../theme/social-icons-master/SVG/White/Tik Tok_white.svg'
import YoutubeWhitePath from '../theme/social-icons-master/SVG/White/Youtube_white.svg'
import PinterestWhitePath from '../theme/social-icons-master/SVG/White/Pinterest_white.svg'
import SnapchatWhitePath from '../theme/social-icons-master/SVG/White/Snapchat_white.svg'
import RedditWhitePath from '../theme/social-icons-master/SVG/White/Reddit_white.svg'
import WhatsAppWhitePath from '../theme/social-icons-master/SVG/White/WhatsApp_white.svg'
import TelegramWhitePath from '../theme/social-icons-master/SVG/White/Telegram_white.svg'
import SafariWhitePath from '../theme/social-icons-master/SVG/White/Safari_white.svg'
import FirefoxWhitePath from '../theme/social-icons-master/SVG/White/Firefox_white.svg'
import EdgeWhitePath from '../theme/social-icons-master/SVG/White/Edge_white.svg'
import OperaWhitePath from '../theme/social-icons-master/SVG/White/Opera_white.svg'
import AndroidWhitePath from '../theme/social-icons-master/SVG/White/Android_white.svg'
import AppleWhitePath from '../theme/social-icons-master/SVG/White/Apple_white.svg'
import WindowsWhitePath from '../theme/social-icons-master/SVG/White/Windows_white.svg'
import UbuntuWhitePath from '../theme/social-icons-master/SVG/White/Ubuntu_white.svg'

// Para los que no tienen SVG, usar los de lucide-react
import { Globe, Link, Smartphone, Monitor, Tablet, MapPin, Mail } from 'lucide-react'

// Componente para renderizar SVG desde path con soporte de theme
function SVGIcon({ src, darkSrc, className }: { src: string; darkSrc?: string; className?: string }) {
  const { theme } = useTheme()
  const iconSrc = theme === 'dark' && darkSrc ? darkSrc : src

  return (
    <img
      src={iconSrc}
      className={className}
      alt=""
      style={{ display: 'inline-block' }}
    />
  )
}

// Wrapper components con soporte para dark/light mode
const FacebookSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={FacebookBlackPath} darkSrc={FacebookWhitePath} className={className} />
)

const InstagramSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={InstagramBlackPath} darkSrc={InstagramWhitePath} className={className} />
)

const GoogleSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={GoogleBlackPath} darkSrc={GoogleWhitePath} className={className} />
)

const TwitterSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={TwitterBlackPath} darkSrc={TwitterWhitePath} className={className} />
)

const TikTokSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={TikTokBlackPath} darkSrc={TikTokWhitePath} className={className} />
)

const YoutubeSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={YoutubeBlackPath} darkSrc={YoutubeWhitePath} className={className} />
)

const PinterestSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={PinterestBlackPath} darkSrc={PinterestWhitePath} className={className} />
)

const SnapchatSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={SnapchatBlackPath} darkSrc={SnapchatWhitePath} className={className} />
)

const RedditSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={RedditBlackPath} darkSrc={RedditWhitePath} className={className} />
)

const WhatsAppSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={WhatsAppBlackPath} darkSrc={WhatsAppWhitePath} className={className} />
)

const TelegramSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={TelegramBlackPath} darkSrc={TelegramWhitePath} className={className} />
)

const SafariSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={SafariBlackPath} darkSrc={SafariWhitePath} className={className} />
)

const FirefoxSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={FirefoxBlackPath} darkSrc={FirefoxWhitePath} className={className} />
)

const EdgeSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={EdgeBlackPath} darkSrc={EdgeWhitePath} className={className} />
)

const OperaSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={OperaBlackPath} darkSrc={OperaWhitePath} className={className} />
)

const AndroidSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={AndroidBlackPath} darkSrc={AndroidWhitePath} className={className} />
)

const AppleSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={AppleBlackPath} darkSrc={AppleWhitePath} className={className} />
)

const WindowsSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={WindowsBlackPath} darkSrc={WindowsWhitePath} className={className} />
)

const UbuntuSVG = ({ className }: { className?: string }) => (
  <SVGIcon src={UbuntuBlackPath} darkSrc={UbuntuWhitePath} className={className} />
)

// Mapeo de nombres a componentes de iconos - ahora con todos los SVGs reales
export const SocialIcons: Record<string, React.ComponentType<any>> = {
  // Redes sociales con SVG personalizado
  'Facebook': FacebookSVG,
  'Facebook Ads': FacebookSVG,
  'Facebook Orgánico': FacebookSVG,
  'Instagram': InstagramSVG,
  'Instagram Ads': InstagramSVG,
  'Instagram Orgánico': InstagramSVG,
  'Google': GoogleSVG,
  'Google Ads': GoogleSVG,
  'Google Orgánico': GoogleSVG,
  'TikTok': TikTokSVG,
  'TikTok Ads': TikTokSVG,
  'Twitter': TwitterSVG,
  'Twitter/X': TwitterSVG,
  'Twitter/X Ads': TwitterSVG,
  'LinkedIn': Globe,  // No existe el SVG, usando icono genérico
  'LinkedIn Ads': Globe,
  'Youtube': YoutubeSVG,
  'YouTube': YoutubeSVG,
  'Pinterest': PinterestSVG,
  'Pinterest Ads': PinterestSVG,
  'Snapchat': SnapchatSVG,
  'Snapchat Ads': SnapchatSVG,
  'Reddit': RedditSVG,
  'Reddit Ads': RedditSVG,
  'WhatsApp': WhatsAppSVG,
  'Telegram': TelegramSVG,

  // Navegadores - ahora con SVGs reales (excepto Chrome que no existe)
  'Chrome': Globe,  // No existe Chrome.svg, usando genérico
  'Safari': SafariSVG,
  'Firefox': FirefoxSVG,
  'Edge': EdgeSVG,
  'Opera': OperaSVG,
  'Mobile Chrome': Globe,
  'Mobile Safari': SafariSVG,

  // Sistemas operativos
  'Android': AndroidSVG,
  'iOS': AppleSVG,
  'iPhone': AppleSVG,
  'iPad': AppleSVG,
  'Mac OS': AppleSVG,
  'macOS': AppleSVG,
  'Windows': WindowsSVG,
  'Windows 10': WindowsSVG,
  'Windows 11': WindowsSVG,
  'Linux': UbuntuSVG,
  'Ubuntu': UbuntuSVG,

  // Dispositivos (usando iconos de lucide-react)
  'Mobile': Smartphone,
  'Desktop': Monitor,
  'Tablet': Tablet,

  // Otros
  'Email': Mail,
  'Directo': Link,
  'Orgánico': Globe,
  'Referidos': Link,
  'Otros': Globe,
  'Other': Globe,
  'Desconocido': Globe,
  'Unknown': Globe,

  // Ubicaciones
  'United States': MapPin,
  'Mexico': MapPin,
  'Canada': MapPin,
  'Spain': MapPin,
  'Argentina': MapPin,
  'Colombia': MapPin,
  'Default': MapPin
}

// Función helper para obtener el ícono correcto - mejorada con todos los SVGs
export function getSocialIcon(name: string): React.ComponentType<any> {
  // Buscar coincidencia exacta primero
  if (SocialIcons[name]) {
    return SocialIcons[name]
  }

  // Buscar coincidencias parciales (case insensitive)
  const lowerName = name.toLowerCase()

  // Redes sociales
  if (lowerName.includes('facebook') || lowerName.includes('fb')) {
    return FacebookSVG
  }
  if (lowerName.includes('instagram') || lowerName.includes('ig')) {
    return InstagramSVG
  }
  if (lowerName.includes('google')) {
    return GoogleSVG
  }
  if (lowerName.includes('tiktok') || lowerName.includes('tik tok')) {
    return TikTokSVG
  }
  if (lowerName.includes('twitter') || lowerName.includes('x.com')) {
    return TwitterSVG
  }
  if (lowerName.includes('linkedin')) {
    return Globe  // No tenemos LinkedIn SVG
  }
  if (lowerName.includes('youtube') || lowerName.includes('yt')) {
    return YoutubeSVG
  }
  if (lowerName.includes('pinterest')) {
    return PinterestSVG
  }
  if (lowerName.includes('snapchat')) {
    return SnapchatSVG
  }
  if (lowerName.includes('reddit')) {
    return RedditSVG
  }
  if (lowerName.includes('whatsapp')) {
    return WhatsAppSVG
  }
  if (lowerName.includes('telegram')) {
    return TelegramSVG
  }

  // Navegadores
  if (lowerName.includes('chrome')) {
    return Globe  // No tenemos Chrome SVG
  }
  if (lowerName.includes('safari')) {
    return SafariSVG
  }
  if (lowerName.includes('firefox')) {
    return FirefoxSVG
  }
  if (lowerName.includes('edge')) {
    return EdgeSVG
  }
  if (lowerName.includes('opera')) {
    return OperaSVG
  }

  // Sistemas operativos
  if (lowerName.includes('android')) {
    return AndroidSVG
  }
  if (lowerName.includes('ios') || lowerName.includes('iphone') || lowerName.includes('ipad') || lowerName.includes('mac')) {
    return AppleSVG
  }
  if (lowerName.includes('windows')) {
    return WindowsSVG
  }
  if (lowerName.includes('linux') || lowerName.includes('ubuntu')) {
    return UbuntuSVG
  }

  // Dispositivos
  if (lowerName.includes('mobile') || lowerName.includes('phone')) {
    return Smartphone
  }
  if (lowerName.includes('desktop') || lowerName.includes('computer')) {
    return Monitor
  }
  if (lowerName.includes('tablet')) {
    return Tablet
  }

  // Para ubicaciones
  if (lowerName.includes('united states') || lowerName.includes('mexico') || lowerName.includes('canada')) {
    return MapPin
  }

  // Icono por defecto
  return Globe
}

// Componente wrapper para renderizar el ícono con estilo consistente
export function SocialIcon({
  name,
  className = "w-5 h-5",
  ...props
}: {
  name: string
  className?: string
  [key: string]: any
}) {
  const Icon = getSocialIcon(name)

  // Si por alguna razón Icon es undefined, usar Globe como fallback
  if (!Icon) {
    console.warn(`Icon not found for: ${name}, using Globe as fallback`)
    return <Globe className={className} {...props} />
  }

  return <Icon className={className} {...props} />
}