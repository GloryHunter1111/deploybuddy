import { supabase } from './supabase'
import { scanRepository, type ScanIssue, type ScanReport } from './scanner'

export interface ProjectRecord {
  id: string
  user_id: string
  name: string
  repo_url: string
  framework: string | null
  netlify_site_id?: string | null
  supabase_project_ref?: string | null
  custom_domain?: string | null
  last_scan_result: {
    issues: ScanIssue[]
    detectedConfig?: {
      framework?: string
      frameworkName?: string
      defaultPublishDir?: string
      defaultBuildCommand?: string
      packageJsonExists?: boolean
      hasBuildScript?: boolean
      netlifyTomlExists?: boolean
      hasSpaRedirect?: boolean
      envExampleExists?: boolean
      referencedEnvVars?: string[]
      documentedEnvVars?: string[]
      scannedFilesCount?: number
    }
    scannedAt?: string
  } | null
  last_deploy_status?: string | null
  created_at: string
  updated_at: string
}

export interface SaveProjectResult {
  success: boolean
  project?: ProjectRecord
  isNew?: boolean
  limitReached?: boolean
  message?: string
}

/**
 * Retrieves the user's plan ('free' or 'pro'). Defaults to 'free'.
 */
export async function getUserPlan(userId: string): Promise<'free' | 'pro'> {
  if (!supabase) return 'free'

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return 'free'
    return data.plan === 'pro' ? 'pro' : 'free'
  } catch {
    return 'free'
  }
}

/**
 * Fetches all saved projects for the authenticated user.
 */
export async function getUserProjects(userId: string): Promise<ProjectRecord[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Failed to load saved projects.')
  }

  return (data as ProjectRecord[]) || []
}

/**
 * Saves a scan report to Supabase projects and scans tables.
 * Enforces 1-project limit on 'free' tier for new projects.
 */
export async function saveProjectScan(
  userId: string,
  report: ScanReport,
): Promise<SaveProjectResult> {
  if (!supabase) {
    return {
      success: false,
      message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.',
    }
  }

  // 1. Fetch existing projects for this user
  const existingProjects = await getUserProjects(userId)
  const repoName = `${report.owner}/${report.repo}`

  const existingProject = existingProjects.find(
    (p) =>
      p.repo_url.toLowerCase().trim() === report.repoUrl.toLowerCase().trim() ||
      p.name.toLowerCase().trim() === repoName.toLowerCase().trim(),
  )

  const scanPayload = {
    issues: report.issues,
    detectedConfig: report.detectedConfig,
    scannedAt: report.scannedAt,
  }

  // 2. If project already exists, update it and add a new scan entry
  if (existingProject) {
    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({
        framework: report.detectedConfig.frameworkName || report.detectedConfig.framework,
        last_scan_result: scanPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingProject.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      return { success: false, message: updateError.message }
    }

    // Insert scan event record
    await supabase.from('scans').insert({
      project_id: existingProject.id,
      issues: report.issues,
      created_at: new Date().toISOString(),
    })

    return {
      success: true,
      project: updated as ProjectRecord,
      isNew: false,
      message: 'Project scan updated successfully.',
    }
  }

  // 3. If new project, enforce free plan limit
  const plan = await getUserPlan(userId)
  if (plan === 'free' && existingProjects.length >= 1) {
    return {
      success: false,
      limitReached: true,
      message: "You've reached the free plan limit of 1 project. Upgrade to save more.",
    }
  }

  // 4. Insert new project row
  const newProjectRow = {
    user_id: userId,
    name: repoName,
    repo_url: report.repoUrl,
    framework: report.detectedConfig.frameworkName || report.detectedConfig.framework,
    last_scan_result: scanPayload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: createdProject, error: insertError } = await supabase
    .from('projects')
    .insert(newProjectRow)
    .select()
    .single()

  if (insertError) {
    return { success: false, message: insertError.message }
  }

  const projectRecord = createdProject as ProjectRecord

  // 5. Insert scan history entry
  await supabase.from('scans').insert({
    project_id: projectRecord.id,
    issues: report.issues,
    created_at: new Date().toISOString(),
  })

  return {
    success: true,
    project: projectRecord,
    isNew: true,
    message: 'Project saved to your workspace.',
  }
}

/**
 * Re-scans a repository and updates the project row in Supabase.
 */
export async function rescanProject(
  project: ProjectRecord,
  onProgress?: (status: string) => void,
): Promise<{ project: ProjectRecord; report: ScanReport }> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const report = await scanRepository(project.repo_url, onProgress)

  const scanPayload = {
    issues: report.issues,
    detectedConfig: report.detectedConfig,
    scannedAt: report.scannedAt,
  }

  const { data: updated, error: updateError } = await supabase
    .from('projects')
    .update({
      framework: report.detectedConfig.frameworkName || report.detectedConfig.framework,
      last_scan_result: scanPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id)
    .eq('user_id', project.user_id)
    .select()
    .single()

  if (updateError) {
    throw new Error(updateError.message || 'Failed to update project.')
  }

  // Record scan history
  await supabase.from('scans').insert({
    project_id: project.id,
    issues: report.issues,
    created_at: new Date().toISOString(),
  })

  return {
    project: updated as ProjectRecord,
    report,
  }
}

/**
 * Deletes a project and its scan history.
 */
export async function deleteProject(projectId: string, userId: string): Promise<void> {
  if (!supabase) return

  // Delete scans first
  await supabase.from('scans').delete().eq('project_id', projectId)

  // Delete project
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message || 'Failed to delete project.')
  }
}
