type User = {
  id: number
  name: string
  email: string
  joinDate: number
  lastVisit: number
  passwordHash: string
  imageUrl?: string
  birthday?: string
  adherence?: number
}

export default User
