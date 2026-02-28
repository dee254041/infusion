import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import type { PagePermissionEntry } from '@/lib/permissions'

export type BarUserRole = 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
export type BarUserStatus = 'active' | 'disabled'

export interface BarUser {
  _id?: ObjectId
  name: string
  email: string
  image?: string
  provider?: 'google'
  providerId?: string
  /** Optional username (e.g. for display); defaults from email if not set */
  username?: string
  phone?: string
  role?: BarUserRole
  status?: BarUserStatus
  /** Whether the user is approved (admin and super_admin are always approved) */
  approved?: boolean
  /** Page-based permissions; only used when role is cashier_admin or manager_admin */
  permissions?: PagePermissionEntry[]
  /** Route-based permissions as array of route strings (e.g., ["/catha/dashboard", "/catha/orders"]) */
  routePermissions?: string[]
  createdAt: Date
  lastLogin?: Date
}

// Use specific database name for Bar users
const DB_NAME = 'infusion_jaba' // Same database, different collection

export async function getBarUserByEmail(email: string): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[Bar User Model] Fetching user from database: ${DB_NAME}, collection: bar_users`)
    const user = await db.collection<BarUser>('bar_users').findOne({ email })
    if (user) {
      console.log(`[Bar User Model] User found: ${user.email}`)
    } else {
      console.log(`[Bar User Model] No user found with email: ${email}`)
    }
    return user
  } catch (error) {
    console.error('[Bar User Model] Error fetching user:', error)
    return null
  }
}

export async function getBarUserByProviderId(providerId: string): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[Bar User Model] Fetching user by providerId from database: ${DB_NAME}, collection: bar_users`)
    const user = await db.collection<BarUser>('bar_users').findOne({ providerId })
    return user
  } catch (error) {
    console.error('[Bar User Model] Error fetching user by providerId:', error)
    return null
  }
}

export async function createBarUser(userData: Omit<BarUser, '_id' | 'createdAt'>): Promise<BarUser> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[Bar User Model] Creating user in database: ${DB_NAME}, collection: bar_users`)
    const newUser: BarUser = {
      ...userData,
      role: userData.role ?? 'pending',
      status: userData.status ?? 'active',
      approved: userData.approved ?? (userData.role === 'cashier_admin' || userData.role === 'manager_admin' || userData.role === 'super_admin'),
      permissions: userData.permissions ?? [],
      routePermissions: userData.routePermissions ?? [],
      createdAt: new Date(),
    }
    const result = await db.collection<BarUser>('bar_users').insertOne(newUser)
    console.log(`[Bar User Model] User created successfully: ${newUser.email} with ID: ${result.insertedId}`)
    return { ...newUser, _id: result.insertedId }
  } catch (error) {
    console.error('[Bar User Model] Error creating user:', error)
    throw error
  }
}

export async function updateBarUserLastLogin(email: string): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    console.log(`[Bar User Model] Updating last login for: ${email}`)
    const result = await db.collection<BarUser>('bar_users').updateOne(
      { email },
      { $set: { lastLogin: new Date() } }
    )
    console.log(`[Bar User Model] Last login updated. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`)
  } catch (error) {
    console.error('[Bar User Model] Error updating last login:', error)
    throw error
  }
}

export async function getAllBarUsers(): Promise<BarUser[]> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const users = await db.collection<BarUser>('bar_users').find({}).sort({ createdAt: -1 }).toArray()
    return users
  } catch (error) {
    console.error('[Bar User Model] Error fetching all users:', error)
    throw error
  }
}

export async function getBarUserById(userId: string): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const user = await db.collection<BarUser>('bar_users').findOne({ _id: new ObjectId(userId) })
    return user
  } catch (error) {
    console.error('[Bar User Model] Error fetching user by ID:', error)
    return null
  }
}

export async function updateBarUser(
  userId: string,
  updates: Partial<Pick<BarUser, 'name' | 'email' | 'username' | 'phone' | 'role' | 'status' | 'approved' | 'permissions' | 'routePermissions'>>
): Promise<BarUser | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const set: Record<string, unknown> = {}
    if (updates.name !== undefined) set.name = updates.name
    if (updates.email !== undefined) set.email = updates.email
    if (updates.username !== undefined) set.username = updates.username
    if (updates.phone !== undefined) set.phone = updates.phone
    if (updates.role !== undefined) {
      set.role = updates.role
      // Auto-set approved based on role
      if (updates.approved === undefined) {
        set.approved = updates.role === 'cashier_admin' || updates.role === 'manager_admin' || updates.role === 'super_admin'
      }
    }
    if (updates.status !== undefined) set.status = updates.status
    if (updates.approved !== undefined) set.approved = updates.approved
    if (updates.permissions !== undefined) set.permissions = updates.permissions
    if (updates.routePermissions !== undefined) set.routePermissions = updates.routePermissions
    if (Object.keys(set).length === 0) return getBarUserById(userId)
    const result = await db.collection<BarUser>('bar_users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: set },
      { returnDocument: 'after' }
    )
    return result ?? null
  } catch (error) {
    console.error('[Bar User Model] Error updating user:', error)
    throw error
  }
}

export async function deleteBarUser(userId: string): Promise<boolean> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const result = await db.collection<BarUser>('bar_users').deleteOne({ _id: new ObjectId(userId) })
    return result.deletedCount === 1
  } catch (error) {
    console.error('[Bar User Model] Error deleting user:', error)
    throw error
  }
}

