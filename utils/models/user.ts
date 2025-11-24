import { getKv } from "../system/db.ts";

export interface User {
  username: string;
  passwordHash: string;
  plan_tier: "free" | "premium";
  ai_addon_unlocked: boolean;
  ai_analyst_unlocked: boolean;
  motherDuckToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function createUser(
  username: string, 
  passwordHash: string, 
  plan_tier: "free" | "premium" = "free",
  ai_addon_unlocked = false,
  ai_analyst_unlocked = false
): Promise<User> {
  const kv = await getKv();
  const key = ["users", username];
  
  const user: User = {
    username,
    passwordHash,
    plan_tier,
    ai_addon_unlocked,
    ai_analyst_unlocked,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Atomic check to ensure username doesn't exist
  const res = await kv.atomic()
    .check({ key, versionstamp: null })
    .set(key, user)
    .commit();

  if (!res.ok) {
    throw new Error("Username already exists");
  }
  
  console.log(`👤 Created user: ${username}`);
  return user;
}

export async function getUser(username: string): Promise<User | null> {
  const kv = await getKv();
  const result = await kv.get<User>(["users", username]);
  return result.value;
}

export async function updateUser(username: string, updates: Partial<Pick<User, "plan_tier" | "ai_addon_unlocked" | "ai_analyst_unlocked" | "motherDuckToken">>): Promise<void> {
  const kv = await getKv();
  const key = ["users", username];
  
  let committed = false;
  while (!committed) {
    const entry = await kv.get<User>(key);
    if (!entry.value) {
      throw new Error("User not found");
    }
    
    const updated: User = {
      ...entry.value,
      ...updates,
      updatedAt: new Date()
    };
    
    const result = await kv.atomic()
      .check(entry)
      .set(key, updated)
      .commit();
      
    committed = result.ok;
  }
  
  console.log(`💾 Updated user: ${username}`, updates);
}
