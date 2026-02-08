import asyncio
from playwright import async_api

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5173", wait_until="commit", timeout=10000)

        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass

        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:5173
        await page.goto("http://localhost:5173", wait_until="commit", timeout=10000)
        
        # -> Click the 'Services' navigation link to open the public-facing service catalog and load the services list.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div/div/header/div/div[1]/nav/a[1]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Wait for the services list to finish loading, extract all visible service cards (name, description, price, business name), then enter the keyword 'Cartagena' into the search input to test filtering.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=html/body/div[1]/div/main/div/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Cartagena')
        
        # -> Enter 'Cartagena' into the search input and extract the updated visible service cards to verify the catalog filtering updates results accordingly.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=html/body/div/div/main/div/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Cartagena')
        
        # -> Enter 'Cartagena' into the search input (clear any existing text), wait for the results to update, then extract the visible service cards to verify that filtering reduces the list accordingly.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=html/body/div/div/main/div/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Cartagena')
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        frame = context.pages[-1]
        # Assert that multiple active services are listed with name, description, price, and business name
        assert await frame.locator("text=Double Room").count() > 0
        assert await frame.locator("text=450.00 XLM").count() > 0
        assert await frame.locator("text=Comfortable double room").count() > 0
        assert await frame.locator("text=Andean Summit Hotel").count() > 0
        assert await frame.locator("text=Conference Room").count() > 0
        assert await frame.locator("text=200.00 XLM").count() > 0
        assert await frame.locator("text=Bogota City Walking Tour").count() > 0
        assert await frame.locator("text=45.00 XLM").count() > 0
        assert await frame.locator("text=Colombia Adventure Tours").count() > 0
        # Wait briefly for filter results to update after typing the keyword
        await page.wait_for_timeout(1000)
        # Verify filtering: results include items mentioning 'Cartagena' and exclude unrelated services
        assert await frame.locator("text=Cartagena").count() > 0
        assert await frame.locator("text=Intercity Bus — Bogota to Cartagena").count() > 0
        assert await frame.locator("text=320.00 XLM").count() > 0
        # Ensure a previously visible unrelated service is no longer present after filtering
        assert await frame.locator("text=Double Room").count() == 0
        assert await frame.locator("text=Coffee Farm Experience").count() == 0
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    