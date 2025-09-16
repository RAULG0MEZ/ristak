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
  const pageSizeOptions = [25, 50, 100, 200]

  // Calculate range
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5 // Maximum visible page numbers

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      // Calculate start and end of range
      let rangeStart = Math.max(2, currentPage - 1)
      let rangeEnd = Math.min(totalPages - 1, currentPage + 1)

      // Add ellipsis if needed
      if (rangeStart > 2) {
        pages.push('...')
      }

      // Add range
      for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i)
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

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 px-4 py-3",
      className
    )}>
      {/* Left side - Results info */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-secondary">
          Mostrando <span className="font-medium text-primary">{start}</span> a{' '}
          <span className="font-medium text-primary">{end}</span> de{' '}
          <span className="font-medium text-primary">{totalItems}</span> resultados
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 glass rounded-lg border border-glassBorder text-sm focus:border-primary focus:outline-none transition-colors"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side - Page navigation */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            "p-2 glass rounded-lg transition-all",
            currentPage === 1
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-white/5 hover:border-primary"
          )}
        >
          <Icons.chevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="px-2 text-secondary">...</span>
            ) : (
              <button
                onClick={() => onPageChange(page as number)}
                className={cn(
                  "min-w-[32px] h-8 px-2 rounded-lg transition-all",
                  currentPage === page
                    ? "bg-primary text-white font-medium"
                    : "glass hover:bg-white/5 hover:border-primary text-secondary"
                )}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            "p-2 glass rounded-lg transition-all",
            currentPage === totalPages
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-white/5 hover:border-primary"
          )}
        >
          <Icons.chevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}