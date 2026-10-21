import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DashboardView } from '../components/DashboardView'
import { TaskListView } from '../components/TaskListView'
import { Navbar } from '../components/Navbar'
import {
  initialDemoOrganization,
  initialDemoActivities,
  initialDemoMembers,
  initialDemoTasks,
} from '../data/demoData'

describe('DashboardView Component', () => {
  it('renders key metrics and active activity information', () => {
    const handleSelectTask = vi.fn()
    const handleNavigate = vi.fn()
    const handleOpenActivity = vi.fn()

    render(
      <DashboardView
        tasks={initialDemoTasks}
        members={initialDemoMembers}
        activeActivity={initialDemoActivities[0]}
        onSelectTask={handleSelectTask}
        onNavigateToTasks={handleNavigate}
        onOpenActivityModal={handleOpenActivity}
      />
    )

    // Checks header
    expect(screen.getByText(initialDemoActivities[0].name)).toBeInTheDocument()
    expect(screen.getByText('Kegiatan Aktif')).toBeInTheDocument()

    // Checks metrics
    expect(screen.getByText('Penyelesaian Tugas')).toBeInTheDocument()
    expect(screen.getByText('Perhatian Mendesak')).toBeInTheDocument()
    expect(screen.getByText('Deadline Terdekat')).toBeInTheDocument()
  })

  it('renders empty state when no active activity exists', () => {
    render(
      <DashboardView
        tasks={[]}
        members={initialDemoMembers}
        activeActivity={null}
        onSelectTask={vi.fn()}
        onNavigateToTasks={vi.fn()}
        onOpenActivityModal={vi.fn()}
      />
    )

    expect(screen.getByText('Belum Ada Kegiatan Aktif')).toBeInTheDocument()
  })

  it('asks the user to create an organization when none exists', () => {
    const onOpenOrgModal = vi.fn()

    render(
      <DashboardView
        tasks={[]}
        members={[]}
        activeActivity={null}
        hasOrganization={false}
        onSelectTask={vi.fn()}
        onNavigateToTasks={vi.fn()}
        onOpenActivityModal={vi.fn()}
        onOpenOrgModal={onOpenOrgModal}
      />
    )

    expect(screen.getByText('Belum Ada Organisasi')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Buat Organisasi Baru'))
    expect(onOpenOrgModal).toHaveBeenCalledTimes(1)
  })
})

describe('TaskListView Component', () => {
  it('renders task rows and responds to search query', () => {
    const onSelectTask = vi.fn()
    const onEditTask = vi.fn()
    const onArchiveTask = vi.fn()
    const onUnarchiveTask = vi.fn()
    const onDeleteTask = vi.fn()
    const onOpenCreateTask = vi.fn()

    render(
      <TaskListView
        tasks={initialDemoTasks}
        members={initialDemoMembers}
        onSelectTask={onSelectTask}
        onEditTask={onEditTask}
        onArchiveTask={onArchiveTask}
        onUnarchiveTask={onUnarchiveTask}
        onDeleteTask={onDeleteTask}
        onOpenCreateTask={onOpenCreateTask}
      />
    )

    // Check table headers
    expect(screen.getByText('Tugas')).toBeInTheDocument()
    expect(screen.getByText('Kategori & Fase')).toBeInTheDocument()

    // Search input
    const searchInput = screen.getByPlaceholderText(/Cari judul tugas/i)
    fireEvent.change(searchInput, { target: { value: 'Proposal' } })

    expect(screen.getByText(/Proposal dan Pengajuan Dana Sponsor/i)).toBeInTheDocument()
    expect(screen.queryByText(/Konfirmasi Pembicara Utama/i)).not.toBeInTheDocument()
  })
})

describe('Navbar Component', () => {
  it('displays organization name, sync mode, and notification counter', () => {
    render(
      <Navbar
        organizations={[initialDemoOrganization]}
        currentOrg={initialDemoOrganization}
        activeActivity={initialDemoActivities[0]}
        syncStatus={{
          mode: 'demo',
          isConnected: false,
          isSyncing: false,
          lastSyncAt: null,
        }}
        notificationCount={3}
        onSelectOrg={vi.fn()}
        onOpenOrgModal={vi.fn()}
        onOpenActivityModal={vi.fn()}
        onOpenNotifications={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCreateTask={vi.fn()}
      />
    )

    expect(screen.getByText('OrgTaskFlow')).toBeInTheDocument()
    expect(screen.getByText(/BEM Fakultas Teknologi Informasi/)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // notification badge
  })

  it('allows opening organization management when there are no organizations', () => {
    const onOpenOrgModal = vi.fn()

    render(
      <Navbar
        organizations={[]}
        currentOrg={null}
        activeActivity={null}
        syncStatus={{
          mode: 'demo',
          isConnected: false,
          isSyncing: false,
          lastSyncAt: null,
        }}
        notificationCount={0}
        onSelectOrg={vi.fn()}
        onOpenOrgModal={onOpenOrgModal}
        onOpenActivityModal={vi.fn()}
        onOpenNotifications={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCreateTask={vi.fn()}
      />
    )

    const select = screen.getByTitle('Pilih Organisasi') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(screen.getByText('-- Belum ada organisasi --')).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'NEW' } })

    expect(onOpenOrgModal).toHaveBeenCalledTimes(1)
    // Reset so the same option can be selected again later.
    expect(select.value).toBe('')
  })
})
