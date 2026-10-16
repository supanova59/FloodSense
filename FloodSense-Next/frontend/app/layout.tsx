import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { Metadata } from 'next';
export const metadata: Metadata={title:'FloodSense | Urban Flood Intelligence',description:'FloodSense frontend demonstration — Bengaluru flood risk monitoring, scenario exploration, community observations and route insights.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
