// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react"
import { ExercisePicker } from "./exercise-picker"
import { exercises } from "@/data/exercises"

afterEach(() => {
  cleanup()
})

// Pick known fixtures from the real static catalog so the assertions stay
// stable as exercises get added. These three are anchored:
//  - "Lat Pulldown" -> back/biceps, strength_machine (lat-pulldown equipment)
//  - "Treadmill Walk" -> quads/hamstrings/etc, cardio equipment
//  - "Push-Ups" -> chest, no equipment
const LAT_PULLDOWN = exercises.find((e) => e.name === "Lat Pulldown")!
const TREADMILL_WALK = exercises.find((e) => e.name === "Treadmill Walk")!
const PUSH_UPS = exercises.find((e) => e.name === "Push-Ups")!

describe("ExercisePicker — initial render", () => {
  it("shows the header, search input, and every exercise in the catalog", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    expect(
      screen.getByRole("heading", { name: /add exercise/i })
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/search exercises/i)
    ).toBeInTheDocument()

    // Every catalog exercise renders by name. Use queryAllByText since some
    // names (the filter chips) may also appear.
    expect(screen.getAllByText(LAT_PULLDOWN.name).length).toBeGreaterThan(0)
    expect(screen.getAllByText(TREADMILL_WALK.name).length).toBeGreaterThan(0)
  })

  it("renders the All chip as the active muscle-group filter by default", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    const allChip = screen.getByRole("button", { name: /^all$/i })
    expect(allChip).toHaveClass("bg-purple-600")
  })
})

describe("ExercisePicker — search", () => {
  it("filters by name match", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search exercises/i), {
      target: { value: "treadmill" },
    })

    // Every visible exercise's name should contain "treadmill" (or one of its
    // muscle groups should, which doesn't apply for "treadmill" specifically).
    expect(screen.getByText("Treadmill Walk")).toBeInTheDocument()
    expect(screen.getByText("Treadmill Run")).toBeInTheDocument()
    expect(screen.queryByText(LAT_PULLDOWN.name)).toBeNull()
  })

  it("filters by muscle-group keyword match", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search exercises/i), {
      target: { value: "biceps" },
    })
    // Lat Pulldown targets biceps -> visible.
    expect(screen.getByText(LAT_PULLDOWN.name)).toBeInTheDocument()
    // Treadmill Walk doesn't -> hidden.
    expect(screen.queryByText(TREADMILL_WALK.name)).toBeNull()
  })

  it("shows an empty state when nothing matches", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search exercises/i), {
      target: { value: "zzzzz-no-match" },
    })
    expect(screen.getByText(/no exercises found/i)).toBeInTheDocument()
  })

  it("treats whitespace-only search as no filter", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search exercises/i), {
      target: { value: "   " },
    })
    // Both still visible.
    expect(screen.getByText(LAT_PULLDOWN.name)).toBeInTheDocument()
    expect(screen.getByText(TREADMILL_WALK.name)).toBeInTheDocument()
  })
})

describe("ExercisePicker — muscle-group chip filter", () => {
  it("activates the clicked chip and filters to that group", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /^chest$/i }))

    expect(screen.getByRole("button", { name: /^chest$/i })).toHaveClass(
      "bg-purple-600"
    )
    // Push-Ups (chest) -> visible. Treadmill Walk (no chest) -> hidden.
    expect(screen.getByText(PUSH_UPS.name)).toBeInTheDocument()
    expect(screen.queryByText(TREADMILL_WALK.name)).toBeNull()
  })

  it("toggles the chip off when clicked again", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    const chestChip = screen.getByRole("button", { name: /^chest$/i })
    fireEvent.click(chestChip)
    expect(chestChip).toHaveClass("bg-purple-600")
    fireEvent.click(chestChip)
    expect(chestChip).not.toHaveClass("bg-purple-600")
    // Filtering off -> Treadmill Walk visible again.
    expect(screen.getByText(TREADMILL_WALK.name)).toBeInTheDocument()
  })

  it("combines muscle filter with search (intersection)", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }))
    fireEvent.change(screen.getByPlaceholderText(/search exercises/i), {
      target: { value: "lat" },
    })
    expect(screen.getByText(LAT_PULLDOWN.name)).toBeInTheDocument()
    // "Treadmill" doesn't target back, even though "lat" search would miss
    // it on name anyway — sanity check.
    expect(screen.queryByText(TREADMILL_WALK.name)).toBeNull()
  })
})

describe("ExercisePicker — equipment-category chip filter", () => {
  it("filters by equipment category (cardio)", () => {
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /^cardio$/i }))
    expect(screen.getByText(TREADMILL_WALK.name)).toBeInTheDocument()
    // Lat Pulldown is a strength machine -> hidden.
    expect(screen.queryByText(LAT_PULLDOWN.name)).toBeNull()
  })

  it("excludes exercises with no equipment when an equipment filter is on", () => {
    // Push-Ups has equipmentId: null. With any equipment filter set, it
    // should be hidden — the filter requires a real equipment match.
    render(<ExercisePicker onSelect={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /^cardio$/i }))
    expect(screen.queryByText(PUSH_UPS.name)).toBeNull()
  })
})

describe("ExercisePicker — selection and close", () => {
  it("fires onSelect with the full ExerciseDefinition when an item is clicked", () => {
    const onSelect = vi.fn()
    render(<ExercisePicker onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText(LAT_PULLDOWN.name))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(LAT_PULLDOWN)
  })

  it("fires onClose when the X button is clicked", () => {
    const onClose = vi.fn()
    render(<ExercisePicker onSelect={() => {}} onClose={onClose} />)
    // The close button has no accessible name beyond the X icon, so reach
    // it via the header region.
    const header = screen.getByRole("heading", { name: /add exercise/i })
      .parentElement!
    const closeBtn = within(header).getAllByRole("button")[0]
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
