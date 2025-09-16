import React from 'react'
import { cn } from '../lib/utils'
import { Icons } from '../icons'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize: number
  totalItems: number
  onPageSizeChange?: (size: number) => void
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
  onPageSizeChange,
  className
}: PaginationProps) {
  const pageSizeOptions = [10, 25, 50, 100]

  // Calculate range
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 7 // Maximum visible page numbers

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      // Calculate start and end of range
      let rangeStart = Math.max(2, currentPage - 2)
      let rangeEnd = Math.min(totalPages - 1, currentPage + 2)

      // Adjust range if at the beginning
      if (currentPage <= 3) {
        rangeEnd = 5
      }

      // Adjust range if at the end
      if (currentPage >= totalPages - 2) {
        rangeStart = totalPages - 4
      }

      // Add ellipsis if needed
      if (rangeStart > 2) {
        pages.push('...')
      }

      // Add range
      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i)
        }
      }

      // Add ellipsis if needed
      if (rangeEnd < totalPages - 1) {
        pages.push('...')
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (totalItems === 0) return null

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4",
      "bg-gradient-to-r from-background/50 via-background/30 to-background/50",
      "border-t border-glassBorder/50 backdrop-blur-sm",
      className
    )}>
      {/* Left side - Results info and page size selector */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Results info with better styling */}
        <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl border border-glassBorder/30">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-tertiary">Mostrando</span>
            <span className="text-sm font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded">
              {start}
            </span>
            <span className="text-sm text-tertiary">-</span>
            <span className="text-sm font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded">
              {end}
            </span>
            <span className="text-sm text-tertiary">de</span>
            <span className="text-sm font-semibold text-info px-2 py-0.5 bg-info/10 rounded">
              {totalItems}
            </span>
          </div>
        </div>

        {/* Page size selector with better design */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl border border-glassBorder/30">
            <span className="text-sm text-tertiary hidden sm:inline">Mostrar:</span>
            <div className="flex items-center gap-1">
              {pageSizeOptions.map(size => (
                <button
                  key={size}
                  onClick={() => onPageSizeChange(size)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-lg transition-all duration-200",
                    pageSize === size
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "hover:bg-white/5 text-secondary hover:text-primary"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right side - Page navigation with improved design */}
      <div className="flex items-center">
        {/* First and Previous buttons group */}
        <div className="flex items-center mr-2">
          {/* First page button */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={cn(
              "p-2 glass rounded-l-xl transition-all duration-200 border-y border-l border-glassBorder/30",
              currentPage === 1
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-white/5 hover:border-primary/30 group"
            )}
            aria-label="Primera página"
          >
            <Icons.chevronLeft className={cn(
              "w-4 h-4 transition-transform",
              currentPage !== 1 && "group-hover:-translate-x-0.5"
            )} />
            <Icons.chevronLeft className={cn(
              "w-4 h-4 -ml-3 transition-transform",
              currentPage !== 1 && "group-hover:-translate-x-0.5"
            )} />
          </button>

          {/* Previous button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={cn(
              "p-2 glass rounded-r-xl transition-all duration-200 border-y border-r border-glassBorder/30",
              currentPage === 1
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-white/5 hover:border-primary/30 group"
            )}
            aria-label="Página anterior"
          >
            <Icons.chevronLeft className={cn(
              "w-4 h-4 transition-transform",
              currentPage !== 1 && "group-hover:-translate-x-0.5"
            )} />
          </button>
        </div>

        {/* Page numbers with better styling */}
        <div className="flex items-center gap-1 px-2">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 text-tertiary select-none">⋯</span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  className={cn(
                    "min-w-[36px] h-9 px-3 rounded-xl font-medium text-sm",
                    "transition-all duration-200 relative",
                    currentPage === page
                      ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25 scale-105"
                      : "glass hover:bg-white/5 hover:border-primary/30 text-secondary hover:text-primary border border-transparent"
                  )}
                >
                  {page}
                  {currentPage === page && (
                    <div className="absolute inset-0 rounded-xl bg-white/10 animate-pulse" />
                  )}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Next and Last buttons group */}
        <div className="flex items-center ml-2">
          {/* Next button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cn(
              "p-2 glass rounded-l-xl transition-all duration-200 border-y border-l border-glassBorder/30",
              currentPage === totalPages
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-white/5 hover:border-primary/30 group"
            )}
            aria-label="Página siguiente"
          >
            <Icons.chevronRight className={cn(
              "w-4 h-4 transition-transform",
              currentPage !== totalPages && "group-hover:translate-x-0.5"
            )} />
          </button>

          {/* Last page button */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={cn(
              "p-2 glass rounded-r-xl transition-all duration-200 border-y border-r border-glassBorder/30",
              currentPage === totalPages
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-white/5 hover:border-primary/30 group"
            )}
            aria-label="Última página"
          >
            <Icons.chevronRight className={cn(
              "w-4 h-4 transition-transform",
              currentPage !== totalPages && "group-hover:translate-x-0.5"
            )} />
            <Icons.chevronRight className={cn(
              "w-4 h-4 -ml-3 transition-transform",
              currentPage !== totalPages && "group-hover:translate-x-0.5"
            )} />
          </button>
        </div>
      </div>

      {/* Quick jump input for large datasets */}
      {totalPages > 10 && (
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl border border-glassBorder/30">
          <span className="text-sm text-tertiary">Ir a:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value)
              if (page >= 1 && page <= totalPages) {
                onPageChange(page)
              }
            }}
            className="w-16 px-2 py-1 text-sm text-center bg-white/5 rounded-lg border border-glassBorder/30
                     focus:border-primary focus:outline-none transition-colors"
          />
          <span className="text-sm text-tertiary">/ {totalPages}</span>
        </div>
      )}
    </div>
  )
}