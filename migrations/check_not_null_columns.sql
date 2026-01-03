-- Check which columns have NOT NULL constraints
-- Run this first to see which columns need to be altered

SELECT 
    t.table_name,
    c.column_name,
    c.is_nullable,
    c.column_default
FROM 
    information_schema.columns c
    JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE 
    t.table_schema = 'public'
    AND c.is_nullable = 'NO'
    AND c.column_name != 'id'  -- Exclude primary key columns
    AND c.column_default IS NULL  -- Exclude columns with defaults (they're effectively nullable)
ORDER BY 
    t.table_name, c.column_name;




