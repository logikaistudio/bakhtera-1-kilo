const fs = require('fs');
const path = require('path');

const dataContextPath = path.join(__dirname, 'src', 'context', 'DataContext.jsx');

if (fs.existsSync(dataContextPath)) {
    let content = fs.readFileSync(dataContextPath, 'utf8');

    // 1. Add state variables
    const stateTarget = `const [bankAccounts, setBankAccounts] = useState([]);`;
    const stateReplacement = `const [bankAccounts, setBankAccounts] = useState([]);
    const [bridgeSettings, setBridgeSettings] = useState(null);
    const [bigSettings, setBigSettings] = useState(null);
    const [bridgeBankAccounts, setBridgeBankAccounts] = useState([]);
    const [bigBankAccounts, setBigBankAccounts] = useState([]);`;
    
    if (!content.includes('const [bridgeSettings')) {
        content = content.replace(stateTarget, stateReplacement);
    }

    // 2. Add variables to export
    const exportTarget = `companySettings,\n        bankAccounts,`;
    const exportReplacement = `companySettings,\n        bankAccounts,\n        bridgeSettings,\n        bigSettings,\n        bridgeBankAccounts,\n        bigBankAccounts,`;
    
    if (!content.includes('bridgeSettings,')) {
        content = content.replace(exportTarget, exportReplacement);
    }

    // 3. Helper to get table name
    const helperFunction = `
    const getSettingsTableName = (module = 'blink') => module === 'blink' ? 'company_settings' : \`\${module}_company_settings\`;
    const getBanksTableName = (module = 'blink') => module === 'blink' ? 'company_bank_accounts' : \`\${module}_company_bank_accounts\`;
    
    const setSettingsState = (module, data) => {
        if (module === 'bridge') setBridgeSettings(data);
        else if (module === 'big') setBigSettings(data);
        else setCompanySettings(data);
    };

    const getSettingsState = (module) => {
        if (module === 'bridge') return bridgeSettings;
        if (module === 'big') return bigSettings;
        return companySettings;
    };

    const setBanksState = (module, data) => {
        if (module === 'bridge') setBridgeBankAccounts(data);
        else if (module === 'big') setBigBankAccounts(data);
        else setBankAccounts(data);
    };

    const getBanksState = (module) => {
        if (module === 'bridge') return bridgeBankAccounts;
        if (module === 'big') return bigBankAccounts;
        return bankAccounts;
    };
    `;

    // Insert helper before fetchCompanySettings
    const helperTarget = `// Company Settings operations`;
    if (!content.includes('getSettingsTableName')) {
        content = content.replace(helperTarget, `${helperTarget}\n${helperFunction}`);
    }

    // 4. Update fetchCompanySettings
    content = content.replace(/const fetchCompanySettings = async \(\) => \{/g, `const fetchCompanySettings = async (module = 'blink') => {`);
    content = content.replace(/\.from\('company_settings'\)/g, `.from(getSettingsTableName(module))`);
    content = content.replace(/setCompanySettings\(settingsData\[0\]\);/g, `setSettingsState(module, settingsData[0]);`);
    
    content = content.replace(/\.from\('company_bank_accounts'\)/g, `.from(getBanksTableName(module))`);
    content = content.replace(/setBankAccounts\(bankData\);/g, `setBanksState(module, bankData);`);

    // 5. Update updateCompanySettings
    content = content.replace(/const updateCompanySettings = async \(settings\) => \{/g, `const updateCompanySettings = async (settings, module = 'blink') => {\n            const currentSettings = getSettingsState(module);`);
    content = content.replace(/companySettings\?/g, `currentSettings?`);
    content = content.replace(/companySettings\./g, `currentSettings.`);
    content = content.replace(/setCompanySettings\(\{ \.\.\.companySettings, \.\.\.settings \}\);/g, `setSettingsState(module, { ...currentSettings, ...settings });`);
    content = content.replace(/setCompanySettings\(data\);/g, `setSettingsState(module, data);`);

    // 6. Update addBankAccount
    content = content.replace(/const addBankAccount = async \(bankAccount\) => \{/g, `const addBankAccount = async (bankAccount, module = 'blink') => {`);
    content = content.replace(/let currentCompanySettings = currentSettings;/g, `let currentCompanySettings = getSettingsState(module);`); // Handle if it exists
    content = content.replace(/let currentCompanySettings = companySettings;/g, `let currentCompanySettings = getSettingsState(module);`);
    content = content.replace(/currentCompanySettings = await fetchCompanySettings\(\);/g, `currentCompanySettings = await fetchCompanySettings(module);`);
    content = content.replace(/display_order: bankAccounts\.length \+ 1/g, `display_order: getBanksState(module).length + 1`);
    content = content.replace(/setBankAccounts\(\[\.\.\.bankAccounts, data\]\);/g, `setBanksState(module, [...getBanksState(module), data]);`);

    // 7. Update updateBankAccount
    content = content.replace(/const updateBankAccount = async \(id, updatedBankAccount\) => \{/g, `const updateBankAccount = async (id, updatedBankAccount, module = 'blink') => {`);
    content = content.replace(/setBankAccounts\(prev =>/g, `setBanksState(module, getBanksState(module).map(bank => bank.id === id ? { ...bank, ...normalizedUpdate } : bank)); //`);

    // 8. Update deleteBankAccount
    content = content.replace(/const deleteBankAccount = async \(id\) => \{/g, `const deleteBankAccount = async (id, module = 'blink') => {`);
    content = content.replace(/setBankAccounts\(prev => prev\.filter\(bank => bank\.id !== id\)\);/g, `setBanksState(module, getBanksState(module).filter(bank => bank.id !== id));`);

    // 9. Update uploadCompanyLogo
    content = content.replace(/const uploadCompanyLogo = async \(file\) => \{/g, `const uploadCompanyLogo = async (file, module = 'blink') => {`);
    content = content.replace(/await updateCompanySettings\(\{[\s\S]*?\.\.\.currentSettings,[\s\S]*?logo_url: publicUrl[\s\S]*?\}\);/g, `await updateCompanySettings({ ...getSettingsState(module), logo_url: publicUrl }, module);`);
    content = content.replace(/await updateCompanySettings\(\{[\s\S]*?\.\.\.companySettings,[\s\S]*?logo_url: publicUrl[\s\S]*?\}\);/g, `await updateCompanySettings({ ...getSettingsState(module), logo_url: publicUrl }, module);`);

    // 10. Also update fetchCompanySettings call in loadInitialData
    content = content.replace(/await fetchCompanySettings\(\);/g, `await fetchCompanySettings('blink');\n                await fetchCompanySettings('bridge');\n                await fetchCompanySettings('big');`);

    fs.writeFileSync(dataContextPath, content);
    console.log('DataContext.jsx updated successfully.');
} else {
    console.log('DataContext.jsx not found!');
}
