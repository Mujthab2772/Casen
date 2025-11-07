export const categoryGet = (req, res) => {
    try {
        res.render("CategoryManagementPage")
    } catch (error) {
        log(`Error from categoryGet: ${error}`);
    }
}

export const addCategory = (req, res) => {
    try {
        res.render("addCategory")
    } catch (error) {
        console.log(`Error from addCategory: ${error}`);
        
    }
}