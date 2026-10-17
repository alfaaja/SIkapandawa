import { expect, test } from '@playwright/test';

test('actual Phaser play records independent aspect answers but shows only the total result', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__sikaGame?.scene.isActive('MainMenu'));
    await page.evaluate(async () => {
        const { AuthService } = await import('/src/game/services/AuthService.ts');
        const { ProgressService } = await import('/src/game/services/ProgressService.ts');
        // A fresh browser with explicit local fixtures: no production login or write.
        AuthService.getActiveAccount = () => ({ id:'local-jejak-fixture',username:'siswa.uji',displayName:'Siswa Uji',schoolName:'Sekolah Uji',createdAt:'2026-10-16T00:00:00Z' });
        ProgressService.getProgress = () => ({ highestUnlockedLevel:10,levelStars:{},introSeen:[],completedLevels:[1,2,3,4,5,6,7,8,9,10],jejakPandawaUnlocked:true,jejakPandawaBestScore:0 });
        ProgressService.recordJejakResult = (_id: string, score: number, answers: unknown) => {
            (window as any).__jejakCaptured = { score,answers };
            return { score,bestScore:score,isNewBest:true,saved:true };
        };
        (window as any).__sikaGame.scene.start('JejakPandawa');
    });
    const desired: Record<string, number> = { kejujuran:2,keberanian:0,kesopanan:1,kebijaksanaan:2,keadilan:1 };
    const seen: Record<string, number> = {};
    for (let index=0;index<10;index++) {
        await page.waitForFunction(index => {
            const scene=(window as any).__sikaGame.scene.getScene('JejakPandawa');
            return scene.cardIndex===index && scene.state==='CARD_ACTIVE';
        },index);
        const card = await page.evaluate(() => {
            const scene=(window as any).__sikaGame.scene.getScene('JejakPandawa');
            scene.time.timeScale=8;
            const card=scene.runCards[scene.cardIndex];
            return { aspect:card.aspect,isGood:card.isGood };
        });
        const correct = (seen[card.aspect]??0) < desired[card.aspect];
        seen[card.aspect]=(seen[card.aspect]??0)+1;
        const goodBasket=correct ? card.isGood : !card.isGood;
        await page.keyboard.press(goodBasket ? 'a' : 'd');
        await page.keyboard.press('Enter');
    }
    await page.waitForFunction(() => (window as any).__sikaGame.scene.isActive('JejakResult'));
    const result=await page.evaluate(async () => {
        const { scoreJejakAnswers } = await import('/src/game/data/jejakPandawa.ts');
        const scene=(window as any).__sikaGame.scene.getScene('JejakResult');
        return { scores:scoreJejakAnswers((window as any).__jejakCaptured.answers),captured:(window as any).__jejakCaptured,
            labels:scene.children.list.filter((child:any)=>child.type==='Text').map((child:any)=>child.text) };
    });
    expect(result.scores).toEqual(desired);
    expect(result.captured.score).toBe(6);
    expect(new Set(result.captured.answers.map((answer:any)=>answer.cardId)).size).toBe(10);
    expect(result.labels).toContain('6/10');
    expect(result.labels.join(' ')).not.toMatch(/Kejujuran|Keberanian|Kesopanan|Kebijaksanaan|Keadilan/);
    await page.locator('#game-container canvas').screenshot({path:testInfo.outputPath('jejak-total-result.png')});
});
