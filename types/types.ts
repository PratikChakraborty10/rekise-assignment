export interface Coordinates {
    lon: number
    lat: number
  }
  
  export interface BasePoint {
    id: string
    coordinates: string
    distance: number | null
    rawCoords: [number, number]
  }
  
  export interface Waypoint extends BasePoint {}
  
  export interface PolygonPoint extends BasePoint {}
  
  export interface PolygonData {
    id: string
    points: PolygonPoint[]
    area: number
    relatedWaypointId: string
    position: 'before' | 'after'
  }
  
  export interface MapState {
    isOpen: boolean
    isDrawingStarted: boolean
    isDrawingComplete: boolean
    isDrawingPolygon: boolean
    activeWaypoint: { id: string, position: 'before' | 'after' } | null
  }